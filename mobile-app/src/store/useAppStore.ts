import { create } from 'zustand';
import { UserSettings } from '../types/index';
import { User } from '@supabase/supabase-js';

interface AppState {
  // Auth state
  user: User | null;
  session: any | null;
  setUser: (user: User | null) => void;
  setSession: (session: any | null) => void;

  // Settings state
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  resetSettings: () => void;

  // Navigation / Tab state
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  soundType: 'silence',
  voiceEnabled: true,
  voiceSpeed: 'normal',
  voiceStyle: 'gentle',
  krishnaMode: true,
  name: '',
  volume: 1.0,
};

export const useAppStore = create<AppState>((set) => ({
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),

  settings: DEFAULT_SETTINGS,
  updateSettings: (newSettings) => 
    set((state) => ({ 
      settings: { ...state.settings, ...newSettings } 
    })),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

  activeTab: 'companion',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
