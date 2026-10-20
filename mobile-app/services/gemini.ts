import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import { supabase } from './supabase';
import { Language } from '../src/types';
import { getTranslation } from '../translations';
import { getChatHeaders, refreshChatToken, primeChatAuth } from './ragAuth';

export async function getEmbedding(text: string): Promise<number[] | null> {
    // Embeddings are generated server-side; provider keys must never ship in the app.
    void text;
    return null;
}

/* ================================================================== *
 *  CHAT MODEL — RagGita API (AWS Lambda Function URL)                 *
 *                                                                     *
 *  Verified contract (live probe se nikala gaya):                     *
 *    POST  {BASE}/chat                                                *
 *    Headers: Content-Type: application/json                          *
 *             X-User-Id: <device uuid>                                *
 *             Authorization: Bearer <firebase id token>               *
 *    Body:    { question, user_class, lang, conversation_id }         *
 *    Reply:   { answer, conversation_id, crisis }                     *
 *    401:     {"detail":"Please sign in to continue."}                *
 *                                                                     *
 *  Koi UI file touch nahi hoti — ChatInterface.tsx abhi bhi           *
 *  getAIResponse(prompt, history, language) hi call karta hai.        *
 * ================================================================== */

const CHAT_PATH = '/chat';
const HEALTH_PATH = '/health';
const CONVERSATION_KEY = 'raggita_conversation_id';

const ATTEMPT_TIMEOUT_MS = 45000;   // Lambda cold start ke liye
const MAX_TOTAL_MS = 100000;        // saare retries milakar
const RETRYABLE_STATUS = new Set([0, 408, 425, 429, 500, 502, 503, 504, 521, 522, 524]);
const BACKOFF_MS = [1500, 3000, 6000, 10000];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const bi = (language: Language, en: string, hi: string) => (language === 'hi' ? hi : en);

function offlineReply(prompt: string, language: Language): string {
    const text = prompt.toLowerCase();
    if (language === 'hi') {
        if (/hello|hi|namaste|नमस्ते/.test(text)) return 'नमस्ते। मैं यहाँ हूँ। आज आपके मन में क्या चल रहा है?';
        if (/stress|anxious| चिंता|तनाव|घबर/.test(text)) return 'धीरे से साँस लें। चार गिनती में साँस अंदर लें, चार गिनती रोकें और छह गिनती में बाहर छोड़ें। अभी आपको सबसे भारी क्या लग रहा है?';
        if (/sad|depress|उदास|अकेला/.test(text)) return 'आपको यह सब अकेले संभालने की ज़रूरत नहीं है। अपनी भावना को छोटे शब्दों में लिखें—मैं आपके साथ उसे समझने की कोशिश करूँगा।';
        return 'मैं अभी ऑफलाइन चिंतन मोड में हूँ। अपने विचार को एक छोटे वाक्य में लिखें और हम उसे धीरे-धीरे समझेंगे।';
    }
    if (/hello|hi|namaste/.test(text)) return 'Namaste. I am here with you. What is moving through your mind today?';
    if (/stress|anxious|panic|overwhelmed/.test(text)) return 'Let us slow this moment down. Breathe in for four counts, pause for four, and breathe out for six. What feels heaviest right now?';
    if (/sad|depress|lonely|alone/.test(text)) return 'You do not have to carry this moment alone. Put the feeling into a few simple words and we can gently understand it together.';
    return 'I am in offline reflection mode right now. Write one simple sentence about what you are feeling, and we will take it one step at a time.';
}

// Conversation id — isse bot ko pichhli baat yaad rehti hai
let conversationId: string | null = null;
let conversationLoaded = false;

async function loadConversationId(): Promise<string> {
    if (!conversationLoaded) {
        try { conversationId = await AsyncStorage.getItem(CONVERSATION_KEY); } catch { }
        conversationLoaded = true;
    }
    return conversationId || '';
}

async function saveConversationId(id: string) {
    if (!id || id === conversationId) return;
    conversationId = id;
    try { await AsyncStorage.setItem(CONVERSATION_KEY, id); } catch { }
}

/** Nayi baat-cheet shuru karni ho to ye call karo (optional). */
export async function resetChatConversation() {
    conversationId = null;
    try { await AsyncStorage.removeItem(CONVERSATION_KEY); } catch { }
}

type CallResult = { ok: boolean; status: number; raw: string };

async function postChat(body: any, headers: Record<string, string>): Promise<CallResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

    try {
        const res = await fetch(Config.CHAT_API_URL + CHAT_PATH, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const raw = await res.text();
        return { ok: res.ok, status: res.status, raw };
    } catch (err: any) {
        const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'network error');
        return { ok: false, status: 0, raw: reason };
    } finally {
        clearTimeout(timer);
    }
}

function friendlyError(status: number, detail: string, language: Language): string {
    if (status === 0) {
        return bi(language,
            "I couldn't reach the server. Please check your internet and try again.",
            "सर्वर तक नहीं पहुँच पाया। कृपया अपना इंटरनेट जाँचें और दोबारा प्रयास करें।");
    }
    if (status === 401 || status === 403) {
        return bi(language,
            "I couldn't verify your session. Please sign out and sign in again.",
            "आपका सत्र सत्यापित नहीं हो सका। कृपया साइन आउट करके दोबारा साइन इन करें।");
    }
    if (status === 404 || status === 405) {
        return bi(language,
            "Chat endpoint not reachable. Please check EXPO_PUBLIC_CHAT_API_URL.",
            "चैट endpoint तक नहीं पहुँच पाया। कृपया EXPO_PUBLIC_CHAT_API_URL जाँचें।");
    }
    if (RETRYABLE_STATUS.has(status)) {
        return bi(language,
            "The wisdom engine is waking up — it was resting. Please send your message again in a few seconds. 🙏",
            "ज्ञान-इंजन अभी जाग रहा है — यह विश्राम में था। कृपया कुछ सेकंड बाद अपना संदेश दोबारा भेजें। 🙏");
    }
    console.error("Chat API detail:", detail.slice(0, 300));
    return getTranslation(language, 'errors.connection');
}

export async function getAIResponse(prompt: string, history: any[], language: Language = 'en') {
    if (!Config.CHAT_API_URL) {
        console.error("❌ CHAT_API_URL not configured");
        return offlineReply(prompt, language);
    }

    const body = {
        question: prompt,
        user_class: 'auto',
        lang: language,                       // 'en' | 'hi'
        conversation_id: await loadConversationId(),
    };

    const startedAt = Date.now();
    let attempt = 0;
    let retriedAuth = false;
    let last: CallResult = { ok: false, status: 0, raw: 'not attempted' };

    while (true) {
        attempt++;
        const headers = await getChatHeaders();
        console.log(`🙏 [RagGita] POST /chat — attempt ${attempt}` +
            (headers.Authorization ? ' (with token)' : ' (NO token!)'));

        last = await postChat(body, headers);

        // --- success ---
        if (last.ok) {
            try {
                const data = JSON.parse(last.raw);
                if (data.conversation_id) await saveConversationId(data.conversation_id);
                if (data.answer) {
                    console.log(`✅ [RagGita] answer received${data.crisis ? ' (crisis flag)' : ''}`);
                    return data.answer as string;
                }
                console.warn("⚠️ 200 OK but no 'answer' field:", last.raw.slice(0, 200));
            } catch (e) {
                console.warn("⚠️ Could not parse response JSON:", last.raw.slice(0, 200));
            }
            return getTranslation(language, 'errors.empty');
        }

        // --- 401: ek baar token force-refresh karke dobara ---
        if ((last.status === 401 || last.status === 403) && !retriedAuth) {
            retriedAuth = true;
            console.warn("🔑 401 — forcing Firebase token refresh and retrying once...");
            await refreshChatToken();
            continue;
        }

        // --- temporary failure: backoff ke saath retry ---
        const backoff = BACKOFF_MS[attempt - 1];
        const elapsed = Date.now() - startedAt;
        const canRetry = RETRYABLE_STATUS.has(last.status)
            && backoff !== undefined
            && (elapsed + backoff) < MAX_TOTAL_MS;

        if (!canRetry) break;

        console.warn(`⏳ [RagGita] status ${last.status} — retrying in ${backoff}ms`);
        await sleep(backoff);
    }

    console.error(`❌ [RagGita] giving up. status=${last.status} body=${last.raw.slice(0, 300)}`);
    // Keep the companion useful during outages, cold starts, and offline use.
    // The UI can still show the conversation and the user can retry later.
    return `${offlineReply(prompt, language)}\n\n${friendlyError(last.status, last.raw, language)}`;
}

/** App start par: Lambda warm + Firebase sign-in shuru. Fire-and-forget. */
export async function warmUpChatModel(): Promise<void> {
    if (!Config.CHAT_API_URL) return;
    primeChatAuth();                       // Firebase sign-in background me
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(Config.CHAT_API_URL + HEALTH_PATH, { signal: controller.signal });
        clearTimeout(timer);
        console.log(`🔥 Chat model warm-up: /health → ${res.status}`);
    } catch {
        // warm-up fail hona theek hai
    }
}

// App load hote hi Lambda jagao aur token le aao
warmUpChatModel();

/**
 * Manual test. Expo console me:
 *   import { testChatModel } from './services/gemini'; testChatModel();
 */
export async function testChatModel() {
    console.log("🧪 Testing chat model at:", Config.CHAT_API_URL + CHAT_PATH);
    const reply = await getAIResponse("Hello, are you working?", [], 'en');
    console.log("Reply:", reply);
    return reply;
}

export async function testAPIKeys() {
    return { backend: Boolean(Config.BACKEND_URL) };
}
