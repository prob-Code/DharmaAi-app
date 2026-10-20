import { Config } from '../config';
import { Language } from '../src/types';

type SarvamVoiceSpeed = 'slow' | 'normal' | 'very-slow';
type SarvamVoiceStyle = 'gentle' | 'deep' | 'soft';

interface SarvamVoiceOptions {
    voiceSpeed?: SarvamVoiceSpeed;
    voiceStyle?: SarvamVoiceStyle;
    krishnaMode?: boolean;
    volume?: number;
}

export async function getSarvamTTS(
    text: string,
    language: Language = 'en',
    options: SarvamVoiceOptions = {}
) {
    if (!Config.BACKEND_URL) return null;

    // Host rewriting is centralized in config.ts so every backend service uses
    // the same URL selected by EXPO_PUBLIC_BACKEND_URL.
    const backendUrl = Config.BACKEND_URL;

    const voiceStyle = options.voiceStyle || 'gentle';
    const voiceSpeed = options.voiceSpeed || 'normal';
    const krishnaMode = !!options.krishnaMode;

    // 1. Select the speaker based on settings
    let speaker = 'priya'; // Sarvam Bulbul v3 female voice
    if (krishnaMode) {
        // Krishna Mode maps to male voices
        if (voiceStyle === 'deep') {
            speaker = 'aditya';
        } else {
            speaker = 'shubh'; // Softer, friendly male voice
        }
    } else {
        // Standard Mode
        if (voiceStyle === 'soft' || voiceStyle === 'gentle') {
            speaker = 'priya'; // Warm storytelling female voice
        } else {
            speaker = 'shubh'; // Or 'amit'
        }
    }

    // 2. Adjust pace for soft, meditative quality
    let basePace = 1.0;
    if (voiceStyle === 'soft') {
        basePace = 0.88;
    } else if (voiceStyle === 'gentle') {
        basePace = 0.94;
    }

    // Apply voiceSpeed modifier
    let finalPace = basePace;
    if (voiceSpeed === 'very-slow') {
        finalPace = basePace * 0.75;
    } else if (voiceSpeed === 'slow') {
        finalPace = basePace * 0.87;
    }

    // Ensure pace is within Sarvam's allowed range (0.5 to 2.0)
    finalPace = Math.max(0.5, Math.min(2.0, finalPace));

    // 3. Set temperature (variation/expressiveness)
    // Lower temperature makes speech flatter/calmer (great for meditative context)
    let temperature = 0.35;
    if (voiceStyle === 'soft') {
        temperature = 0.15;
    } else if (voiceStyle === 'gentle') {
        temperature = 0.25;
    } else if (voiceStyle === 'deep') {
        temperature = 0.45;
    }

    try {
        console.log(`🎙️ Requesting Sarvam AI TTS (bulbul:v3) with speaker: ${speaker}, pace: ${finalPace.toFixed(2)}, temp: ${temperature}`);
        
        const response = await fetch(`${backendUrl}/api/tts/sarvam`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: text.trim().slice(0, 2500),
                language_code: language === 'hi' ? 'hi-IN' : 'en-IN',
                speaker: speaker,
                pace: finalPace,
                temperature: temperature,
                speech_sample_rate: 22050,
                output_audio_codec: 'wav',
                model: "bulbul:v3"
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Sarvam AI TTS Error:", response.status, errorText);
            return null;
        }

        const data = await response.json();
        return data.audios?.[0] || null;
        
    } catch (e) {
        console.error("❌ Sarvam TTS Exception:", e);
        return null;
    }
}
