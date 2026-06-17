export const COLORS = {
    background: '#030303',     // OLED Black
    surface: '#111111',        // Elevated surface
    surfaceHighlight: '#1A1A1A', // Interactive surface
    border: 'rgba(255, 255, 255, 0.08)', // Apple-style micro-border
    accent: '#D4B483', // Soft Gold for spiritual elegance
    text: '#EDEDED', // Starlight White (less eye strain than #FFF)
    muted: '#888888',
    saffron: '#A35D47',
};

export const ONBOARDING_QUESTIONS = [
    "What name would you like me to use?",
    "In this moment, how heavy does your heart feel?",
    "Is your mind a crowded marketplace or a still lake?",
    "Does the future worry you, or the past hold you back?",
    "Shall we step into the stillness together?"
];

// Using a more painterly, artistic depiction for the "Presence"
export const KRISHNA_IMAGE = require('./assets/krishna.png');
export const KRISHNA_IMAGE_URL = "https://example.com/krishna.png"; // Fallback
export const KRISHNA_VIDEO_URL = "https://mtiltptnumjoaibgpvzb.supabase.co/storage/v1/object/public/assets/krishna_intro.mp4";

// Therapeutic ambient sounds for mental wellness
// Using SUPABASE STORAGE to reduce app bundle size and fix Out of Memory errors
export type SoundName = 'flute' | 'rain' | 'waves' | 'om' | 'healing' | 'silence';

const SUPABASE_URL = 'https://mtiltptnumjoaibgpvzb.supabase.co';

// Sound file mapping - exact names in Supabase bucket
const SOUND_URLS: Record<string, string> = {
    flute: `${SUPABASE_URL}/storage/v1/object/public/assets/flute.mp3`,
    healing: `${SUPABASE_URL}/storage/v1/object/public/assets/pino.mp3`,
    om: `${SUPABASE_URL}/storage/v1/object/public/assets/kalsstockmedia-deep-om-chants-with-reverb-229614.mp3`,
    rain: `${SUPABASE_URL}/storage/v1/object/public/assets/rain.mp3`,
    waves: `${SUPABASE_URL}/storage/v1/object/public/assets/dragon-studio-soothing-ocean-waves-372489.mp3`,
};

// Test all sound URLs to see which ones exist
export const testAllSounds = async () => {
    console.log("🔍 Testing all sound files...");
    const results: Record<string, any> = {};
    
    for (const [name, url] of Object.entries(SOUND_URLS)) {
        try {
            // Test with CORS enabled
            const response = await fetch(url, { 
                method: 'GET',
                headers: { 
                    'Range': 'bytes=0-1',
                    'Accept': 'audio/mpeg, audio/*'
                },
                mode: 'cors' // Explicitly enable CORS
            });
            
            const status = response.status;
            const size = response.headers.get('content-length') || 'unknown';
            const contentType = response.headers.get('content-type') || 'unknown';
            const accessControl = response.headers.get('access-control-allow-origin') || 'none';
            
            results[name] = {
                success: response.ok,
                status,
                size,
                contentType,
                cors: accessControl
            };
            
            console.log(
                `${response.ok ? '✅' : '❌'} ${name}: ${status} (${size} bytes) - ${contentType}\n` +
                `   CORS: ${accessControl}\n   URL: ${url}`
            );
        } catch (error) {
            results[name] = {
                success: false,
                error: String(error)
            };
            console.error(`❌ ${name}: ${error}`);
        }
    }
    
    console.log("📊 Summary:", results);
    return results;
};

// Helper to safely fetch sounds from your Supabase bucket
const getRemoteSoundUrl = (soundName: string) => {
    if (soundName === 'silence') {
        return null;
    }
    const url = SOUND_URLS[soundName];
    if (!url) {
        console.warn(`Sound file not found: ${soundName}`);
        return null;
    }
    return { uri: url };
};

// Export sound getter function
export const getSoundAsset = (soundType: string) => {
    return getRemoteSoundUrl(soundType);
};

// Mood-based sound recommendations for therapeutic use
export const MOOD_SOUND_MAP: Record<string, SoundName> = {
    depressed: 'healing',    // Gentle piano for emotional uplift
    anxious: 'rain',         // Rain sounds to calm racing thoughts
    stressed: 'waves',       // Ocean waves for stress relief
    neutral: 'flute',        // Soft flute for general calm
    spiritual: 'om',         // OM meditation for deeper practice
};

// YouTube Data API configuration
export const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? '';
export const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
