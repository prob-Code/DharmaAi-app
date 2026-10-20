import { create } from 'zustand';
import { UserSettings } from '../types/index';
import type { CompatUser } from '../../services/supabase';

interface AppState {
  // Auth state
  session: any | null;
  user: CompatUser | null;
  setUser: (user: CompatUser | null) => void;
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
  voiceStyle: 'soft',
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
