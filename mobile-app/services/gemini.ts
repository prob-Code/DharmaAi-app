import { GoogleGenAI, Modality } from "@google/genai";
import { Config } from '../config';
import { supabase } from './supabase';
import { Language } from '../src/types';
import { getTranslation } from '../translations';

export async function getEmbedding(text: string): Promise<number[] | null> {
    try {
        const API_KEY = Config.GEMINI_API_KEY;
        if (!API_KEY || API_KEY.includes('AIzaSyCq-QbQ9t0H2o4VETWNFkJ99tDjitn281k')) return null;

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

export async function getAIResponse(prompt: string, history: any[], language: Language = 'en') {
    try {
        const RAGGITA_KEY = Config.RAGGITA_API_KEY;

        // Check if API key is configured
        if (!RAGGITA_KEY) {
            console.error("❌ RAGGITA API key not configured");
            return language === 'hi'
                ? "कृपया config.ts में अपनी RAGGITA API key जोड़ें।"
                : "Please add your RAGGITA API key in config.ts.";
        }

        console.log("🙏 Sending question to RAGGITA API...");

        const res = await fetch("https://agentcrafter-rag-gita.hf.space/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": RAGGITA_KEY,
            },
            body: JSON.stringify({
                question: prompt,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ RAGGITA API error:", res.status, errorText);
            return language === 'hi'
                ? `API त्रुटि: ${res.status}. कृपया अपनी API key जांचें।`
                : `API error: ${res.status}. Please check your API key.`;
        }

        const data = await res.json();
        let text = data.answer;

        if (!text) {
            console.error("❌ Empty response from RAGGITA API");
            return getTranslation(language, 'errors.empty');
        }

        console.log("✅ Got RAGGITA response");
        return text;

    } catch (err) {
        console.error("❌ RAGGITA API error:", err);
        return getTranslation(language, 'errors.connection');
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
