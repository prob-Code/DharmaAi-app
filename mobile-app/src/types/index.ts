
export type SoundType = 'flute' | 'rain' | 'waves' | 'om' | 'healing' | 'silence';

export interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: number;
}

export interface ReflectionPost {
    id: string;
    author: string; // Keeps deprecated for compatibility but maps to user.display_name
    user_id: string; // Maps to Supabase user_id
    content: string;
    moodTag?: string; // Maps to mood_tag
    timestamp: number; // Maps to created_at
    replies: ReflectionReply[];
    likes: number; // Maps to likes_count
    user?: { // Populated from profiles
        username: string;
        display_name: string;
        avatar_url?: string;
    };
    isLiked?: boolean; // Client-side state
}

export interface ReflectionReply {
    id: string;
    author: string;
    user_id: string;
    content: string;
    timestamp: number;
    user?: {
        username: string;
        display_name: string;
        avatar_url?: string;
    };
}

export enum AppState {
    ONBOARDING = 'onboarding',
    CHAT = 'chat',
    REFLECTIONS = 'reflections',
    VIDEOS = 'videos',
    PHILOSOPHY_DETAILS = 'philosophy_details'
}

export type Language = 'en' | 'hi';

export interface UserSettings {
    name: string;
    language: Language;
    voiceEnabled: boolean;
    krishnaMode: boolean;
    soundType: SoundType;
    voiceSpeed: 'slow' | 'normal' | 'very-slow';
    voiceStyle: 'gentle' | 'deep' | 'soft';
    volume: number;
}
