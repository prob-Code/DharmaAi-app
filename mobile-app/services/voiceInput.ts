import { Audio } from 'expo-av';
import { Config } from '../config';
import { supabase } from './supabase';

export type VoiceState = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'TRANSCRIBED' | 'ERROR';

export interface VoiceInputCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (transcript: string) => void;
  onError: (message: string) => void;
}

const STT_TIMEOUT_MS = 15000;

/**
 * Uploads a recorded audio file to the backend STT endpoint as multipart/form-data.
 * The backend performs automatic language detection and returns a transcript.
 *
 * The request carries the authenticated Supabase session's access token
 * (`Authorization: Bearer <token>`) so the backend can validate it against the
 * existing Supabase auth infrastructure. No service-role or private credential
 * ever leaves the server.
 *
 * Response classification (preserved hardening):
 *  - 401 -> session expired/invalid (user must sign in again)
 *  - 403 -> account not allowed to use this route
 *  - 413 -> recording too large
 *  - 429 -> rate limited
 *  - 5xx -> controlled retryable provider/service failure
 * Timeout aborts the underlying request (AbortController) so the upload truly
 * stops instead of silently continuing in the background.
 */
async function sendAudioToBackend(fileUri: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? null;

  const response = await fetch(fileUri);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append('file', blob, 'recording.m4a');
  formData.append('model', 'saaras:v3');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);

  try {
    const sttResponse = await fetch(`${Config.BACKEND_URL}/api/ai/stt`, {
      method: 'POST',
      body: formData,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    });

    if (sttResponse.status === 401) {
      throw new Error('Authentication expired');
    }
    if (sttResponse.status === 403) {
      throw new Error('Voice input is not available for your account');
    }
    if (sttResponse.status === 413) {
      throw new Error('Recording too long to transcribe');
    }
    if (sttResponse.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    if (sttResponse.status >= 500) {
      throw new Error('STT service temporarily unavailable');
    }
    if (!sttResponse.ok) {
      let errorMessage = `STT request failed (${sttResponse.status})`;
      try {
        const errorData = await sttResponse.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await sttResponse.json();
    if (!data.transcript || typeof data.transcript !== 'string') {
      throw new Error('Malformed response from STT endpoint');
    }

    const transcript = data.transcript.trim();
    if (!transcript || /^(silence|no speech|no audio|empty)$/.test(transcript.toLowerCase())) {
      throw new Error('No speech detected');
    }

    return transcript;
  } catch (error: any) {
    // A client-side abort (our 15s timeout) and a network-level abort are both
    // retryable "timed out" classifications. Genuine user cancellation is
    // handled separately by the caller's isCancelled guard — never here.
    if (
      error?.name === 'AbortError' ||
      (error?.message && String(error.message).toLowerCase().includes('abort'))
    ) {
      throw new Error('STT request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

    if (this.isCancelled) {
      this.setState('IDLE');
      return;
    }

    try {
      const transcript = await Promise.race([
        sendAudioToBackend(uri),
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
      } else if (
        message.includes('Authentication expired') ||
        message.includes('session has ended')
      ) {
        this.setState('ERROR');
        this.callbacks.onError('Your session has ended. Please sign in again.');
      } else if (message.includes('not available for your account')) {
        this.setState('ERROR');
        this.callbacks.onError('Voice input is not available for your account right now.');
      } else if (message.includes('temporarily unavailable')) {
        this.setState('ERROR');
        this.callbacks.onError('Voice input is temporarily unavailable. Please try again.');
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
