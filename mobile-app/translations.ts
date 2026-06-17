
import { Language } from './src/types';

export const TRANSLATIONS = {
    en: {
        greeting: "Be at peace, {name}. I am here. Tell me, what weighs upon your spirit in the quiet of this day?",
        placeholder: "Whisper your thoughts...",
        send: "Send",
        mic: "Speak",
        ambient: "Ambient Presence",
        soundscape: "Soundscape",
        sounds: {
            flute: "🎶 Flute",
            rain: "🌧️ Rain",
            waves: "🌊 Waves",
            om: "🕉️ Om",
            healing: "💚 Healing",
            silence: "🤫 Silence"
        },
        reflections: {
            title: "Reflections",
            subtitle: "A quiet space for shared inquiry and wordless understanding.",
            leaveFragment: "Leave a fragment of your heart",
            count: "reflections",
            wisdom: "Wisdom flows in silence"
        },
        onboarding: {
            step: "Step",
            of: "of",
            placeholder: "Type your name...",
            skip: "Skip this thought",
            continue: "Continue Gently",
            note: "Take your time. There is no rush in these reflections.",
            preparing: "Preparing your space...",
            chooseLanguage: "Choose your language"
        },
        settings: {
            title: "Personal Harmony",
            language: "Language",
            krishna: "Divine Presence",
            krishnaDesc: "Subtle visuals during responses",
            voice: "Voice Guidance",
            voiceDesc: "Gentle audio alongside text",
            sound: "Background Sound",
            speed: "Voice Speed",
            back: "Back to Serenity",
            speeds: {
                "very-slow": "Very Slow",
                "slow": "Slow",
                "normal": "Normal"
            },
            style: "Voice Tone",
            styles: {
                gentle: "Gentle",
                deep: "Deep",
                soft: "Soft"
            }
        },
        errors: {
            connection: "I apologize, I am having trouble connecting. Please try again.",
            empty: "I am here with you. Take a slow breath."
        },
        videos: {
            title: "Sacred Wisdom",
            subtitle: "Search YouTube for spiritual content",
            search: "Search: meditation, chakra, healing, yoga...",
            searching: "Searching YouTube...",
            foundVideos: "Found {count} video{plural}",
            noResults: "No results found for \"{query}\". Showing curated videos instead.",
            noVideos: "No videos found",
            tryDifferent: "Try a different search term",
            quickSearch: "🔍 Quick Search:",
            nowPlaying: "Now Playing",
            closePlayer: "Close Player"
        },
        thinking: "..."
    },
    hi: {
        greeting: "शांत रहें, {name}. मैं यहाँ हूँ। कहिए, आज के इस एकांत में आपके मन पर क्या बोझ है?",
        placeholder: "अपने विचार धीरे से कहें...",
        send: "भेजें",
        mic: "बोलें",
        ambient: "वातावरण ध्वनि",
        soundscape: "ध्वनि",
        sounds: {
            flute: "🎶 बांसुरी",
            rain: "🌧️ वर्षा",
            waves: "🌊 लहरें",
            om: "🕉️ ओम",
            healing: "💚 उपचार",
            silence: "🤫 मौन"
        },
        reflections: {
            title: "प्रतिबिंब",
            subtitle: "साझा पूछताछ और शब्दहीन समझ के लिए एक शांत स्थान।",
            leaveFragment: "अपने दिल का एक अंश छोड़ें",
            count: "प्रतिबिंब",
            wisdom: "मौन में ज्ञान बहता है"
        },
        onboarding: {
            step: "चरण",
            of: "का",
            placeholder: "अपना नाम टाइप करें...",
            skip: "इस विचार को छोड़ें",
            continue: "धीरे से जारी रखें",
            note: "अपना समय लें। इन प्रतिबिंबों में कोई जल्दबाजी नहीं है।",
            preparing: "आपका स्थान तैयार हो रहा है...",
            chooseLanguage: "अपनी भाषा चुनें"
        },
        settings: {
            title: "व्यक्तिगत संतुलन",
            language: "भाषा",
            krishna: "दिव्य उपस्थिति",
            krishnaDesc: "उत्तर के दौरान सूक्ष्म दृश्य",
            voice: "ध्वनि मार्गदर्शन",
            voiceDesc: "पाठ के साथ कोमल स्वर",
            sound: "पृष्ठभूमि ध्वनि",
            speed: "स्वर गति",
            back: "शांति की ओर लौटें",
            speeds: {
                "very-slow": "अति धीमा",
                "slow": "धीमा",
                "normal": "सामान्य"
            },
            style: "आवाज़ का लहज़ा",
            styles: {
                gentle: "कोमल",
                deep: "गंभीर",
                soft: "मृदु"
            }
        },
        errors: {
            connection: "क्षमा करें, संपर्क में समस्या आ रही है। कृपया पुनः प्रयास करें।",
            empty: "मैं आपके साथ हूँ। एक गहरी साँस लें।"
        },
        videos: {
            title: "पवित्र ज्ञान",
            subtitle: "आध्यात्मिक सामग्री के लिए यूट्यूब खोजें",
            search: "खोजें: ध्यान, चक्र, उपचार, योग...",
            searching: "यूट्यूब पर खोज रहे हैं...",
            foundVideos: "{count} वीडियो मिल{plural}",
            noResults: "\"{query}\" के लिए कोई परिणाम नहीं मिला। इसके बजाय चयनित वीडियो दिखा रहे हैं।",
            noVideos: "कोई वीडियो नहीं मिला",
            tryDifferent: "एक अलग खोज शब्द आज़माएं",
            quickSearch: "🔍 त्वरित खोज:",
            nowPlaying: "अभी चल रहा है",
            closePlayer: "प्लेयर बंद करें"
        },
        thinking: "..."
    }
};

export const getTranslation = (lang: Language, key: string, params: Record<string, string> = {}) => {
    const keys = key.split('.');
    let value: any = TRANSLATIONS[lang as keyof typeof TRANSLATIONS];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key; // Fallback to key if not found
        }
    }

    if (typeof value === 'string') {
        return value.replace(/{(\w+)}/g, (_, param) => params[param] || `{${param}}`);
    }

    return value;
};
