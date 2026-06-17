import { Config } from '../config';
import { Language } from '../src/types';

type SarvamVoiceSpeed = 'slow' | 'normal' | 'very-slow';

interface SarvamVoiceOptions {
    voiceSpeed?: SarvamVoiceSpeed;
    volume?: number;
}

const PACE_MAP: Record<SarvamVoiceSpeed, number> = {
    'very-slow': 0.82,
    'slow': 0.9,
    'normal': 0.97,
};

export async function getSarvamTTS(
    text: string,
    language: Language = 'en',
    options: SarvamVoiceOptions = {}
) {
    const API_KEY = Config.SARVAM_API_KEY;
    if (!API_KEY) return null;

    const voiceSpeed = options.voiceSpeed || 'slow';

    try {
        console.log("🎙️ Requesting Sarvam AI TTS (bulbul:v3)...");
        
        const response = await fetch("https://api.sarvam.ai/text-to-speech", {
            method: "POST",
            headers: {
                "api-subscription-key": API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: [text],
                target_language_code: language === 'hi' ? 'hi-IN' : 'en-IN',
                speaker: language === 'hi' ? 'meera' : 'amit',
                pace: PACE_MAP[voiceSpeed],
                speech_sample_rate: 22050,
                enable_preprocessing: true,
                model: "bulbul:v3"
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Sarvam AI TTS Error:", response.status, errorText);
            return null;
        }

        const data = await response.json();
        // Sarvam returns base64 in audios[0]
        return data.audios?.[0] || null;
        
    } catch (e) {
        console.error("❌ Sarvam TTS Exception:", e);
        return null;
    }
}
