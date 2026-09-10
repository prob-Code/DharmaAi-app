import { Audio } from 'expo-av';
import { Config } from '../config';

export type VoiceState = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'TRANSCRIBED' | 'ERROR';

export interface VoiceInputCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (transcript: string) => void;
  onError: (message: string) => void;
}

const STT_TIMEOUT_MS = 15000;

/**
 * Reads a local file URI as a base64 string using fetch + FileReader.
 * Works in React Native where expo-file-system is not installed.
 */
async function readLocalFileAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix: "data:audio/m4a;base64,XXXX"
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to read audio file'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read audio file'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends base64 audio to the parent backend /api/ai/stt endpoint.
 * Returns the transcript string.
 */
async function sendAudioToBackend(base64: string, language?: string): Promise<string> {
  const response = await fetch(`${Config.BACKEND_URL}/api/ai/stt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio: base64,
      language,
    }),
  });

  if (!response.ok) {
    let errorMessage = `STT request failed (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data.transcript || typeof data.transcript !== 'string') {
    throw new Error('Malformed response from STT endpoint');
  }
  return data.transcript;
}

export class VoiceInputService {
  private recording: Audio.Recording | null = null;
  private state: VoiceState = 'IDLE';
  private callbacks: VoiceInputCallbacks;
  private isCancelled = false;

  constructor(callbacks: VoiceInputCallbacks) {
    this.callbacks = callbacks;
  }

  private async cleanupRecording(recording?: Audio.Recording | null): Promise<void> {
    const target = recording ?? this.recording;
    if (!target) {
      return;
    }

    try {
      await target.stopAndUnloadAsync();
    } catch (error) {
      console.warn('Recording cleanup warning:', error instanceof Error ? error.message : error);
    } finally {
      if (this.recording === target) {
        this.recording = null;
      }
    }
  }

  getState(): VoiceState {
    return this.state;
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  /**
   * Requests microphone permission and starts recording.
   * Returns true if recording started successfully.
   */
  async startRecording(): Promise<boolean> {
    if (this.state === 'RECORDING' || this.state === 'PROCESSING' || this.recording) {
      return false;
    }

    this.isCancelled = false;

    if (this.recording) {
      await this.cleanupRecording(this.recording);
    }

    // Request microphone permission
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      this.setState('ERROR');
      this.callbacks.onError('Microphone permission denied');
      return false;
    }

    // Configure audio mode for recording
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.warn('Failed to set audio mode:', e);
    }

    // Create and start recording
    const recording = new Audio.Recording();
    this.recording = recording;

    try {
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      await recording.startAsync();
      this.setState('RECORDING');
      return true;
    } catch (e: any) {
      await this.cleanupRecording(recording);
      this.setState('ERROR');
      this.callbacks.onError('Recording failed: ' + (e?.message || 'Unknown error'));
      return false;
    }
  }

  /**
   * Stops recording, reads the audio file, and sends it to the backend for STT.
   * On success, calls onTranscript with the transcript.
   * On failure, calls onError with a human-friendly message.
   */
  async stopAndTranscribe(): Promise<void> {
    if (!this.recording) {
      return;
    }

    const recording = this.recording;
    this.recording = null;

    try {
      await this.cleanupRecording(recording);
    } catch (e: any) {
      console.warn('stopAndUnloadAsync warning:', e?.message);
    }

    const uri = recording.getURI();
    if (!uri) {
      this.setState('ERROR');
      this.callbacks.onError("I didn't quite catch that. Try again.");
      return;
    }

    this.setState('PROCESSING');

    // Read the audio file as base64
    let base64: string;
    try {
      base64 = await readLocalFileAsBase64(uri);
    } catch (e: any) {
      this.setState('ERROR');
      this.callbacks.onError("I didn't quite catch that. Try again.");
      return;
    }

    if (!base64 || base64.length === 0) {
      this.setState('ERROR');
      this.callbacks.onError("I didn't quite catch that. Try again.");
      return;
    }

    // Check for cancellation
    if (this.isCancelled) {
      this.setState('IDLE');
      return;
    }

    const language = 'en';

    // Send to backend with timeout
    try {
      const transcript = await Promise.race([
        sendAudioToBackend(base64, language),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('STT request timed out')), STT_TIMEOUT_MS)
        ),
      ]);

      if (this.isCancelled) {
        this.setState('IDLE');
        return;
      }

      if (!transcript || transcript.trim().length === 0) {
        this.setState('ERROR');
        this.callbacks.onError("I didn't quite catch that. Try again.");
        return;
      }

      this.setState('TRANSCRIBED');
      this.callbacks.onTranscript(transcript.trim());
    } catch (e: any) {
      if (this.isCancelled) {
        this.setState('IDLE');
        return;
      }

      const message = e?.message || '';
      if (message.includes('timed out')) {
        this.setState('ERROR');
        this.callbacks.onError("I didn't quite catch that. Try again.");
      } else if (message.includes('Rate limit')) {
        this.setState('ERROR');
        this.callbacks.onError("I'm a bit busy right now. Please wait a moment and try again.");
      } else if (message.includes('not configured')) {
        this.setState('ERROR');
        this.callbacks.onError("Voice input is not yet available. Please try typing.");
      } else {
        this.setState('ERROR');
        this.callbacks.onError("I didn't quite catch that. Try again.");
      }
    }
  }

  /**
   * Cancels any ongoing recording or transcription.
   */
  async cancel(): Promise<void> {
    this.isCancelled = true;

    if (this.recording) {
      await this.cleanupRecording(this.recording);
    }

    this.setState('IDLE');
  }

  /**
   * Resets the service to IDLE state.
   */
  reset(): void {
    this.isCancelled = false;
    this.setState('IDLE');
  }
}
