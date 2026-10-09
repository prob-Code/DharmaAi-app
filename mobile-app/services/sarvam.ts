import { Config } from '../config';
import { supabase } from './supabase';
import { Language } from '../src/types';

type SarvamVoiceSpeed = 'slow' | 'normal' | 'very-slow';

interface SarvamVoiceOptions {
    voiceSpeed?: SarvamVoiceSpeed;
    volume?: number;
}

const TTS_TIMEOUT_MS = 15000;

/**
 * Requests TTS audio from the authenticated backend (POST /api/ai/tts).
 *
 * The Sarvam API key stays server-side; the mobile client only presents the
 * Supabase session's access token. Returns the base64 audio string, or null on
 * any controlled failure so callers can fall back to Gemini TTS / system
 * speech. A single Supabase refresh+retry handles expired tokens; genuine user
 * cancellation is governed by the caller's active-turn guard, never here.
 */
export async function getSarvamTTS(
    text: string,
    language: Language = 'en',
    options: SarvamVoiceOptions = {}
) {
    if (!text || !text.trim()) return null;

    try {
        const { data: sessionData } = await supabase.auth.getSession();
        let accessToken = sessionData.session?.access_token ?? null;
        if (!accessToken) return null;

        let response = await callBackendTts(text, language, options, accessToken);

        // Expired access token? Refresh exactly once, then retry.
        if (response.status === 401) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            const refreshedToken = refreshed.session?.access_token;
            if (refreshedToken) {
                accessToken = refreshedToken;
                response = await callBackendTts(text, language, options, accessToken);
            }
        }

        if (!response.ok) {
            console.warn(`Sarvam TTS (via backend) request failed (${response.status})`);
            return null;
        }

        const data = await response.json();
        if (!data || typeof data.audio !== 'string' || data.audio.length === 0) {
            console.warn('Malformed TTS response from backend');
            return null;
        }

        return data.audio;
    } catch (e) {
        // Log the error name only — never the user text, tokens, or bodies.
        console.error('Sarvam TTS (via backend) error:', e instanceof Error ? e.name : 'unknown');
        return null;
    }
}

async function callBackendTts(
    text: string,
    language: Language,
    options: SarvamVoiceOptions,
    accessToken: string
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
    try {
        return await fetch(`${Config.BACKEND_URL}/api/ai/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                text,
                language,
                voiceSpeed: options.voiceSpeed ?? 'slow',
            }),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}