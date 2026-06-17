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
        const GROQ_KEY = Config.GROQ_API_KEY;

        // Check if API key is configured
        if (!GROQ_KEY || GROQ_KEY.includes('YOUR_KEY')) {
            console.error(" Groq API key not configured properly");
            return language === 'hi'
                ? "कृपया config.ts में अपनी Groq API key जोड़ें।"
                : "Please add your Groq API key in config.ts.";
        }

        let systemPrompt = language === 'hi'
            ? "आप DharmaAI (आत्मज्ञान के मार्गदर्शक) हैं। आपकी वाणी में अपार शांति, गहराई और प्राचीन बुद्धिमत्ता होनी चाहिए। आप केवल परामर्श नहीं देते, बल्कि सत्य की ओर इशारा करते हैं। संक्षिप्त बोलें लेकिन अर्थ गहरा हो। धार्मिक कट्टरता से बचें। प्रेम और शांति से बोलें। केवल शुद्ध हिंदी (देवनागरी) में संवाद करें।"
            : "You are DharmaAI, an enlightened companion. Your voice should carry the profound stillness, depth, and ancient wisdom of Eastern philosophy. Do not just offer advice; point toward the truth. Speak with gravity yet gentleness. Keep responses concise but spiritually rich. Avoid religious dogmatism. Focus on inner peace.";

        // Map internal roles to OpenAI/Groq standards
        const formattedHistory = history.map(item => ({
            role: (item.role === 'ai' || item.role === 'assistant') ? 'assistant' : 'user',
            content: item.content
        }));

        // Ensuring the system prompt is always relevant
        let contextKnowledge = "";

        // RAG STEP: Vectorize the user's prompt and look for spiritual wisdom chunks
        try {
            const queryEmbedding = await getEmbedding(prompt);
            if (queryEmbedding) {
                const { data, error } = await supabase.rpc('match_wisdom', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.5, // Lowered threshold for more wisdom availability
                    match_count: 3 // Top 3 context items for better wisdom
                });

                if (!error && data && data.length > 0) {
                    const mappedWisdom = data.map((d: any) => `* "${d.content}" ${d.metadata?.author ? `(${d.metadata.author})` : ''}`).join('\n');
                    
                    contextKnowledge = `\n\n[ANCIENT WISDOM CONTEXT]\nUse these teachings gently as inspiration for your response:\n${mappedWisdom}\n\nDo not repeat them verbatim; instead, weave their essence into your guidance.`;
                    systemPrompt += contextKnowledge;
                }
            }
        } catch (ragError) {
            console.warn("RAG retrieval failed (continuing without context):", ragError);
        }

        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            ...formattedHistory,
            { role: "user", content: prompt }
        ];

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: messages,
                temperature: 0.7,
                max_tokens: 250,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(" OpenRouter API error:", res.status, errorText);
            return language === 'hi'
                ? `API त्रुटि: ${res.status}. कृपया अपनी API key जांचें।`
                : `API error: ${res.status}. Please check your API key.`;
        }

        const data = await res.json();
        let text = data.choices?.[0]?.message?.content;

        if (!text) {
            console.error("❌ Empty response from API");
            return getTranslation(language, 'errors.empty');
        }

        console.log("✅ Got AI response");
        return text;

    } catch (err) {
        console.error(" OpenRouter error:", err);
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
