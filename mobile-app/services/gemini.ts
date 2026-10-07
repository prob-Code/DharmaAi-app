import { GoogleGenAI, Modality } from "@google/genai";
import { Config } from '../config';
import { supabase } from './supabase';
import { Language } from '../src/types';
import { getTranslation } from '../translations';
import type { CompanionPromptPayload } from './companion/companionPrompt';

function buildRagCompanionContext(
    companionPrompt?: CompanionPromptPayload | null,
): Record<string, unknown> | null {
    if (!companionPrompt) return null;

    const behavior = companionPrompt.systemBehavior;
    const context = companionPrompt.context;

    return {
        response_depth: context.responseDepth ?? behavior.defaultResponseDepth,
        current_topic: context.currentTopic || 'check-in',
        research_domain: context.researchDomain ?? null,
        interaction_mode: context.interactionMode ?? 'conversation',
        user_speaks_more_than_companion: Boolean(behavior.userSpeaksMoreThanCompanion),
        listen_before_responding: Boolean(behavior.listenBeforeResponding),
        follow_current_topic: Boolean(behavior.followCurrentTopic),
        do_not_force_gita: Boolean(behavior.doNotForceGitaWisdom),
        do_not_diagnose: Boolean(behavior.doNotDiagnoseOrCure),
        do_not_make_consequential_decisions: Boolean(behavior.doNotMakeConsequentialLifeDecisions),
        do_not_encourage_dependence: Boolean(behavior.doNotEncourageDependence),
    };
}

export async function getEmbedding(text: string): Promise<number[] | null> {
    try {
        const API_KEY = Config.GEMINI_API_KEY;
        if (!API_KEY) return null;

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: text,
        });

        return response.embeddings?.[0]?.values || null;
    } catch (err) {
        console.error("Embedding Error:", err);
        return null;
    }
}

export interface RagChatResult {
    ok: boolean;
    text: string;
}

// Production RAG endpoint. The AWS Lambda resolves the Gita knowledge base
// server-side and authenticates the caller with a Supabase access token
// (Authorization: Bearer <access_token>). It returns a `{ ok, text }`
// envelope; failed responses must never enter the voice path.
const RAG_CHAT_URL = 'https://umeb6yo26i43ac3sokedfjhgs40keuig.lambda-url.ap-south-1.on.aws/chat';

async function callRagChat(
    accessToken: string,
    payload: Record<string, unknown>,
): Promise<Response> {
    return fetch(RAG_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });
}

export async function getAIResponse(
    prompt: string,
    history: any[],
    language: Language = 'en',
    companionPrompt?: CompanionPromptPayload | null,
): Promise<RagChatResult> {
    const retrievalQuestion = prompt.trim();
    const companionContextPayload = buildRagCompanionContext(companionPrompt);

    // Preserve the companion context payload exactly.
    const payload: Record<string, unknown> = {
        question: retrievalQuestion,
    };

    if (companionContextPayload) {
        payload.companion_context = companionContextPayload;
    }

    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
            console.error("❌ RAG chat requires an authenticated Supabase session");
            return {
                ok: false,
                text: language === 'hi'
                    ? "आपका सत्र समाप्त हो गया है। कृपया फिर से साइन इन करें।"
                    : "Your session has ended. Please sign in again.",
            };
        }

        let res = await callRagChat(accessToken, payload);

        // Expired access token? Refresh exactly once, then retry.
        if (res.status === 401) {
            console.log("♻️ Refreshing Supabase session and retrying RAG chat...");
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            const refreshedToken = refreshed.session?.access_token;
            if (!refreshError && refreshedToken) {
                res = await callRagChat(refreshedToken, payload);
            }
        }

        if (res.status === 401) {
            console.error("❌ RAG chat unauthorized after token refresh");
            return {
                ok: false,
                text: language === 'hi'
                    ? "आपका सत्र समाप्त हो गया है। कृपया फिर से साइन इन करें।"
                    : "Your session has ended. Please sign in again.",
            };
        }

        if (res.status === 403) {
            console.error("❌ RAG chat forbidden (403)");
            return {
                ok: false,
                text: language === 'hi'
                    ? "यह सुविधा आपके खाते के लिए अभी उपलब्ध नहीं है।"
                    : "This feature is not available for your account right now.",
            };
        }

        if ([500, 502, 503, 504].includes(res.status)) {
            console.error(`❌ RAG chat upstream failure (${res.status})`);
            return {
                ok: false,
                text: language === 'hi'
                    ? "Companion AI अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद प्रयास करें।"
                    : "Companion AI is temporarily unavailable. Please try again shortly.",
            };
        }

        if (!res.ok) {
            console.error(`❌ RAG chat API error: ${res.status}`);
            return {
                ok: false,
                text: language === 'hi'
                    ? `API त्रुटि: ${res.status}. कृपया पुनः प्रयास करें।`
                    : `API error: ${res.status}. Please try again.`,
            };
        }

        const data = await res.json();
        if (data && typeof data.ok === 'boolean') {
            const text = typeof data.text === 'string' ? data.text : '';

            if (data.ok) {
                if (text) {
                    console.log("✅ Got RAG response");
                    return { ok: true, text };
                }
                console.error("❌ Empty response from RAG API");
                return { ok: false, text: getTranslation(language, 'errors.empty') };
            }

            // The RAG service itself reported a controlled failure — surfaced
            // as text only, never spoken.
            console.error("❌ RAG service reported failure:", text || '(no message)');
            return { ok: false, text: text || getTranslation(language, 'errors.connection') };
        }

        console.error("❌ Malformed RAG response");
        return { ok: false, text: getTranslation(language, 'errors.connection') };

    } catch (err) {
        console.error("❌ RAG chat error:", err);
        return { ok: false, text: getTranslation(language, 'errors.connection') };
    }
}

export async function testAPIKeys() {
    console.log("🧪 Testing API Keys...\n");

    // Test 1: Groq API
    console.log("1️ Testing Groq API...");
    try {
        const GROQ_KEY = Config.GROQ_API_KEY;
        
        if (!GROQ_KEY || GROQ_KEY.includes('YOUR_KEY')) {
            console.error("❌ Groq API key not configured");
            return { groq: false, gemini: false };
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "user", content: "Say 'OK' if you understand." }
                ],
                temperature: 0.5,
                max_tokens: 10,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ Groq API Failed:", res.status, errorText);
            return { groq: false, gemini: false };
        }

        const data = await res.json();
        const responseText = data.choices?.[0]?.message?.content;
        
        if (responseText) {
            console.log("✅ Groq API Working! Response:", responseText);
        } else {
            console.error("❌ Groq API returned empty response");
            return { groq: false, gemini: false };
        }
    } catch (err: any) {
        console.error("❌ Groq API Error:", err.message);
        return { groq: false, gemini: false };
    }

    // Test 2: Gemini API (Text Embedding)
    console.log("\n2️⃣ Testing Gemini API (Embeddings)...");
    try {
        const API_KEY = Config.GEMINI_API_KEY;
        
        if (!API_KEY || API_KEY.includes('YOUR_KEY')) {
            console.error("❌ Gemini API key not configured");
            return { openrouter: true, gemini: false };
        }

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: "test",
        });

        if (response.embeddings?.[0]?.values) {
            console.log("✅ Gemini API Working! Got embeddings with", response.embeddings[0].values.length, "dimensions");
            return { groq: true, gemini: true };
        } else {
            console.error("❌ Gemini API returned no embeddings");
            return { groq: true, gemini: false };
        }
    } catch (err: any) {
        console.error("❌ Gemini API Error:", err.message);
        return { groq: true, gemini: false };
    }
}

// Map styles to Gemini voices
// voices: Puck, Charon, Kore, Fenrir, Aoede
const VOICE_MAP = {
    gentle: 'Kore',
    deep: 'Fenrir',
    soft: 'Aoede'
};

export async function getGeminiTTS(text: string, voiceStyle: 'gentle' | 'deep' | 'soft' = 'gentle', language: Language = 'en') {
    const API_KEY = Config.GEMINI_API_KEY;
    if (!API_KEY || API_KEY.includes('YOUR_KEY')) return null;

    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });

        let promptText = text;
        if (language === 'en') {
            promptText = `Say calmly and slowly: ${text}`;
        } else {
            // For Hindi, clean up potential English artifacts
            promptText = text.replace(/[A-Za-z]/g, '').trim() || text;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ parts: [{ text: promptText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: VOICE_MAP[voiceStyle] || 'Kore'
                        },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio;
    } catch (e) {
        console.error("TTS Error:", e);
        return null;
    }
}
