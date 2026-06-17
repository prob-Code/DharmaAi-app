
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Animated } from 'react-native';
import { Video } from 'expo-av';
import * as Speech from 'expo-speech';
import { BlurView } from 'expo-blur';
import { Mic, Send, Music, Volume2, VolumeX, Settings } from 'lucide-react-native';
import { Message, UserSettings } from '../src/types';
import { getTranslation } from '../translations';
import { getAIResponse, getGeminiTTS } from '../services/gemini';
import { getSarvamTTS } from '../services/sarvam';
import { getSoundAsset, COLORS, KRISHNA_IMAGE, KRISHNA_VIDEO_URL, testAllSounds } from '../constants';
import { useTheme } from '../context/ThemeContext';

// Import Audio only for native platforms to avoid web conflicts
let Audio: any = null;
if (Platform.OS !== 'web') {
    try {
        const expoAv = require('expo-av');
        Audio = expoAv.Audio;
    } catch (e) {
        console.warn('Failed to load expo-av');
    }
}

interface Props {
    settings: UserSettings;
    onUpdateSettings: (settings: Partial<UserSettings>) => void;
    onOpenSettings: () => void;
}

export const ChatInterface: React.FC<Props> = ({ settings, onUpdateSettings, onOpenSettings }) => {
    const { theme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sound, setSound] = useState<any>(null);
    const [voiceSound, setVoiceSound] = useState<any>(null);
    const [isAmbientPlaying, setIsAmbientPlaying] = useState(true); // Auto-play background sound
    const [krishnaOpacity] = useState(new Animated.Value(0));
    const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
    const ambientVolumeRef = useRef(0);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    
    // Web audio ref for HTML5 Audio API
    const webAudioRef = useRef<HTMLAudioElement | null>(null);
    const webVideoRef = useRef<HTMLVideoElement | null>(null);

    // Memoize dynamic styles based on theme
    const dynamicStyles = useMemo(() => ({
        containerBg: { backgroundColor: theme.colors.background },
        textColor: { color: theme.colors.text },
        mutedColor: { color: theme.colors.muted },
        accentColor: { color: theme.colors.accent },
        userBubbleBg: { 
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
        },
        aiBubbleBg: { 
            backgroundColor: theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'
        },
        userText: { color: theme.isDark ? '#E8EAF6' : '#1a1a1a' },
        aiText: { color: theme.isDark ? '#E8EAF6' : '#1a1a1a' },
        inputBg: { 
            backgroundColor: theme.isDark ? 'rgba(25, 30, 45, 0.6)' : 'rgba(255, 255, 255, 0.8)'
        },
        inputBorder: { 
            borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'
        },
        sendButtonBg: { backgroundColor: theme.colors.accent },
        sendButtonText: { color: theme.isDark ? '#000' : '#FFF' },
        sendButtonLoader: theme.isDark ? '#000' : '#FFF',
        haloColor: `rgba(${theme.isDark ? '212, 180, 131' : '163, 93, 71'}, 0.2)`,
    }), [theme]);

    // Initialize Greeting & User Interaction Listener
    useEffect(() => {
        if (messages.length === 0) {
            const greeting: Message = {
                id: 'greeting',
                role: 'ai',
                content: getTranslation(settings.language, 'greeting', { name: settings.name }),
                timestamp: Date.now(),
            };
            setMessages([greeting]);
        }

        // Enable audio playback after user interaction (browser autoplay policy)
        if (Platform.OS === 'web') {
            const enableAudioOnInteraction = async () => {
                console.log("👆 User interaction detected, enabling audio...");
                if (webAudioRef.current && !webAudioRef.current.paused) {
                    console.log("✅ [WEB] Audio already playing, no need to re-enable");
                    return;
                }
                
                try {
                    if (webAudioRef.current && webAudioRef.current.src) {
                        // Small volume ramp to prevent audio burst
                        webAudioRef.current.volume = 0.05;
                        const playPromise = webAudioRef.current.play();
                        if (playPromise !== undefined) {
                            await playPromise;
                            // Ramp up to target volume
                            setTimeout(() => {
                                if (webAudioRef.current) {
                                    webAudioRef.current.volume = 0.2;
                                }
                            }, 300);
                            console.log("✅ [WEB] Audio enabled and playing after user interaction");
                        }
                    }
                } catch (error: any) {
                    if (error.name !== 'NotAllowedError') {
                        console.warn("⚠️ [WEB] Could not enable audio:", error);
                    }
                }
                
                // Remove listener after first interaction to avoid repeated calls
                document.removeEventListener('click', enableAudioOnInteraction);
                document.removeEventListener('touchstart', enableAudioOnInteraction);
            };
            
            // Add one-time listeners for user interaction (click or touch anywhere)
            document.addEventListener('click', enableAudioOnInteraction, { once: true });
            document.addEventListener('touchstart', enableAudioOnInteraction, { once: true });
            
            return () => {
                document.removeEventListener('click', enableAudioOnInteraction);
                document.removeEventListener('touchstart', enableAudioOnInteraction);
            };
        }
    }, [settings.language]);



    // Avatar Visual Effect: Pulse when thinking or speaking
    useEffect(() => {
        // Show avatar when explicitly enabled, OR temporarily show when thinking/speaking
        const shouldShow = settings.krishnaMode || isLoading || isVoiceSpeaking;

        Animated.timing(krishnaOpacity, {
            toValue: shouldShow ? 1.0 : 0.0,
            duration: 500,
            useNativeDriver: true,
        }).start();

        // Handle Web video playback specifically to bypass browser autoplay restrictions
        if (Platform.OS === 'web' && webVideoRef.current) {
            if (shouldShow) {
                webVideoRef.current.muted = true;
                webVideoRef.current.play().catch(e => console.log("📹 [WEB] Background video play failed:", e));
            } else {
                webVideoRef.current.pause();
            }
        }

        if (isVoiceSpeaking) {
            // Speaking indicator: Fast heartbeat / talking pulse
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, { toValue: 1.04, duration: 250, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 1.0, duration: 250, useNativeDriver: true })
                ])
            ).start();
        } else if (isLoading) {
            // Thinking indicator: Slow deep breathing
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true })
                ])
            ).start();
        } else {
            // Reset scale when idle
            scaleAnim.stopAnimation();
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        }
    }, [isLoading, settings.krishnaMode, isVoiceSpeaking]);

    // ==========================================
    // AUDIO CONFIGURATION (Mental Wellness Optimized)
    // ==========================================
    const AUDIO_CONFIG = {
        // Background ambient sound
        ambient: {
            normalVolume: 0.2,      // Low, calming background level
            duckedVolume: 0.05,     // Very low when voice is speaking
            fadeInDuration: 2000,   // 2 second smooth fade-in
            fadeSteps: 20,          // Smooth transition steps
        },
        // Voice TTS output
        voice: {
            volume: 0.75,           // Softer spiritual delivery while staying clear
        }
    };

    // ==========================================
    // AMBIENT SOUND - Loading (Web + Native compatible)
    // ==========================================
    useEffect(() => {
        let currentSound: any = null;
        let fadeInterval: NodeJS.Timeout | null = null;

        const loadSoundWeb = async (url: string, soundName?: string) => {
            // Use HTML5 Audio for web - avoid expo-av on web
            if (!webAudioRef.current) {
                try {
                    // Use HTMLAudioElement directly for web
                    const audio = document.createElement('audio') as HTMLAudioElement;
                    audio.loop = true;
                    audio.volume = 0;
                    audio.crossOrigin = 'anonymous';
                    // Add to document so browser can load it properly
                    audio.style.display = 'none';
                    document.body.appendChild(audio);
                    webAudioRef.current = audio;
                } catch (e) {
                    console.error("❌ [WEB] Failed to create audio element:", e);
                    return;
                }
            }
            
            webAudioRef.current.src = url;
            console.log(`🎵 [WEB] Loading audio (${soundName}): ${url}`);
            
            // Preload the audio
            webAudioRef.current.preload = 'auto';
            
            return new Promise((resolve) => {
                let loadTimeout: NodeJS.Timeout;
                let loadAttempts = 0;
                const maxAttempts = 2;
                
                const onCanPlay = () => {
                    clearTimeout(loadTimeout);
                    webAudioRef.current?.removeEventListener('canplay', onCanPlay);
                    webAudioRef.current?.removeEventListener('error', onError);
                    webAudioRef.current?.removeEventListener('loadstart', onLoadStart);
                    console.log(`✅ [WEB] Audio ready to play (${soundName})`);
                    resolve(true);
                };
                
                const onError = (e: Event) => {
                    clearTimeout(loadTimeout);
                    webAudioRef.current?.removeEventListener('canplay', onCanPlay);
                    webAudioRef.current?.removeEventListener('error', onError);
                    webAudioRef.current?.removeEventListener('loadstart', onLoadStart);
                    
                    const errorCode = webAudioRef.current?.error?.code;
                    const errorMsg = webAudioRef.current?.error?.message || 'Unknown error';
                    const errorTypes: Record<number, string> = {
                        1: 'ABORTED',
                        2: 'NETWORK',
                        3: 'DECODE',
                        4: 'NOT_SUPPORTED'
                    };
                    const errorType = errorTypes[errorCode as number] || `Code ${errorCode}`;
                    
                    console.error(`❌ [WEB] Audio loading error (${soundName}): ${errorType} - ${errorMsg}`);
                    console.error(`🔗 URL: ${url}`);
                    
                    // Try to load from URL directly as fallback
                    loadAttempts++;
                    if (loadAttempts < maxAttempts) {
                        console.log(`🔄 [WEB] Retrying (attempt ${loadAttempts + 1}/${maxAttempts})...`);
                        setTimeout(() => {
                            if (webAudioRef.current) {
                                webAudioRef.current.load();
                            }
                        }, 800);
                    } else {
                        console.error(`❌ [WEB] Failed to load ${soundName} after ${maxAttempts} attempts`);
                        resolve(false);
                    }
                };
                
                const onLoadStart = () => {
                    console.log(`🔄 [WEB] Audio loading started (${soundName})...`);
                };
                
                webAudioRef.current!.addEventListener('canplay', onCanPlay, { once: false });
                webAudioRef.current!.addEventListener('error', onError, { once: false });
                webAudioRef.current!.addEventListener('loadstart', onLoadStart, { once: true });
                
                // Load the audio
                webAudioRef.current!.load();
                
                // Timeout after 8 seconds
                loadTimeout = setTimeout(() => {
                    webAudioRef.current?.removeEventListener('canplay', onCanPlay);
                    webAudioRef.current?.removeEventListener('error', onError);
                    console.error(`❌ [WEB] Audio loading timeout for: ${url}`);
                    resolve(false);
                }, 8000);
            });
        };

        const loadSoundNative = async (soundAsset: any) => {
            // Use expo-av only for native platforms
            if (!Audio) {
                console.error(`❌ [NATIVE] Audio API not available`);
                return;
            }
            
            try {
                console.log(`🎵 [NATIVE] Loading audio from:`, soundAsset);
                const { sound: newSound } = await Audio.Sound.createAsync(
                    soundAsset,
                    { isLooping: true, volume: 0 }
                );
                currentSound = newSound;
                setSound(newSound);
                console.log(`✅ [NATIVE] Sound loaded successfully!`);
            } catch (error) {
                console.error(`❌ [NATIVE] Error:`, error);
            }
        };

        const loadSound = async () => {
            try {
                // Ensure audio mode is set for background playback (native only)
                if (Platform.OS !== 'web' && Audio) {
                    try {
                        await Audio.setAudioModeAsync({
                            playsInSilentModeIOS: true,
                            staysActiveInBackground: true,
                            shouldDuckAndroid: true,
                        });
                    } catch (e) {
                        console.warn(`⚠️ [NATIVE] Failed to set audio mode:`, e);
                    }
                }

                // Skip if silence is selected
                if (settings.soundType === 'silence') {
                    console.log("🔇 Silence mode selected - no ambient sound");
                    if (webAudioRef.current) {
                        webAudioRef.current.pause();
                        webAudioRef.current.src = '';
                    }
                    setSound(null);
                    return;
                }

                const soundAsset = getSoundAsset(settings.soundType);
                if (!soundAsset) {
                    console.error(`❌ Sound file not available: ${settings.soundType}`);
                    return;
                }

                // Load based on platform
                if (Platform.OS === 'web') {
                    const success = await loadSoundWeb(soundAsset.uri, settings.soundType);
                    
                    // If rain/waves fails, fallback to flute
                    if (!success && (settings.soundType === 'rain' || settings.soundType === 'waves')) {
                        console.warn(`⚠️ Falling back to flute due to ${settings.soundType} loading failure`);
                        const fluteAsset = getSoundAsset('flute');
                        if (fluteAsset) {
                            await loadSoundWeb(fluteAsset.uri, 'flute');
                        }
                    }
                } else if (Audio) {
                    await loadSoundNative(soundAsset);
                } else {
                    console.error(`❌ No audio API available for ${Platform.OS}`);
                }
            } catch (error) {
                console.error(`❌ Error in loadSound:`, error);
            }
        };

        loadSound();

        return () => {
            if (fadeInterval) clearInterval(fadeInterval);
            if (currentSound && Audio) {
                try {
                    currentSound.unloadAsync();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
            setSound(null);
            if (webAudioRef.current) {
                webAudioRef.current.pause();
            }
        };
    }, [settings.soundType]);

    // ==========================================
    // AMBIENT SOUND - Playback with Smooth Fade-In
    // ==========================================
    useEffect(() => {
        let fadeInterval: NodeJS.Timeout | null = null;

        const fadeIn = async () => {
            const { normalVolume, fadeInDuration, fadeSteps } = AUDIO_CONFIG.ambient;
            const stepDuration = fadeInDuration / fadeSteps;
            const volumeStep = normalVolume / fadeSteps;
            let currentVolume = 0;

            // Play based on platform
            if (Platform.OS === 'web') {
                if (!webAudioRef.current) {
                    console.log("❌ Web audio not initialized");
                    return;
                }
                try {
                    webAudioRef.current.volume = 0;
                    // Browser autoplay policy: only play after user interaction
                    // Use play() which returns a Promise that may reject if not allowed
                    const playPromise = webAudioRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                console.log("🎶 [WEB] Audio is now playing");
                            })
                            .catch((error) => {
                                if (error.name === 'NotAllowedError') {
                                    console.warn("⚠️ [WEB] Autoplay blocked - will retry on first user interaction");
                                    // Retry playback after first user interaction (browser autoplay policy)
                                    const resumeAudio = () => {
                                        webAudioRef.current?.play()
                                            .then(() => console.log("🎶 [WEB] Audio resumed after user interaction"))
                                            .catch(() => { /* ignore secondary failures */ });
                                        document.removeEventListener('click', resumeAudio);
                                        document.removeEventListener('touchstart', resumeAudio);
                                    };
                                    document.addEventListener('click', resumeAudio, { once: true });
                                    document.addEventListener('touchstart', resumeAudio, { once: true });
                                } else {
                                    console.error("❌ [WEB] Play failed:", error);
                                }
                            });
                    }
                    console.log("🎶 [WEB] Starting fade-in...");
                } catch (e) {
                    console.error("❌ [WEB] Play setup failed:", e);
                    return;
                }
            } else {
                if (!sound) {
                    console.log("❌ Native sound not initialized");
                    return;
                }
                try {
                    await sound.playAsync();
                    console.log("🎶 [NATIVE] Starting fade-in...");
                } catch (e) {
                    console.error("❌ [NATIVE] Play failed:", e);
                    return;
                }
            }

            fadeInterval = setInterval(async () => {
                currentVolume += volumeStep;
                if (currentVolume >= normalVolume) {
                    currentVolume = normalVolume;
                    if (fadeInterval) clearInterval(fadeInterval);
                    console.log("🎶 Fade-in complete, volume:", normalVolume);
                }

                try {
                    if (Platform.OS === 'web' && webAudioRef.current) {
                        webAudioRef.current.volume = currentVolume;
                    } else if (sound) {
                        await sound.setVolumeAsync(currentVolume);
                    }
                    ambientVolumeRef.current = currentVolume;
                } catch (e) {
                    // Ignore
                }
            }, stepDuration);
        };

        const pauseAmbient = async () => {
            if (fadeInterval) clearInterval(fadeInterval);

            if (Platform.OS === 'web') {
                if (webAudioRef.current) {
                    webAudioRef.current.pause();
                    console.log("⏸️ [WEB] Ambient paused");
                }
            } else {
                if (sound) {
                    try {
                        await sound.pauseAsync();
                        console.log("⏸️ [NATIVE] Ambient paused");
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        };

        if (isAmbientPlaying) {
            fadeIn();
        } else {
            pauseAmbient();
        }

        return () => {
            if (fadeInterval) clearInterval(fadeInterval);
        };
    }, [sound, isAmbientPlaying]);

    // ==========================================
    // VOLUME DUCKING - Lower ambient when voice speaks
    // ==========================================
    useEffect(() => {
        if (!isAmbientPlaying) return;

        const duckVolume = async () => {
            const { duckedVolume, normalVolume } = AUDIO_CONFIG.ambient;
            const targetVolume = isVoiceSpeaking ? duckedVolume : normalVolume;

            if (Platform.OS === 'web') {
                if (webAudioRef.current) {
                    webAudioRef.current.volume = targetVolume;
                }
            } else {
                if (sound) {
                    try {
                        await sound.setVolumeAsync(targetVolume);
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        };

        duckVolume();
    }, [isVoiceSpeaking, sound, isAmbientPlaying]);

    // Toggle Ambient
    const toggleAmbient = () => {
        console.log("🔊 Toggling ambient:", !isAmbientPlaying ? "ON" : "OFF");
        setIsAmbientPlaying(prev => !prev);
    };

    // Audio Diagnostics for web browser console
    useEffect(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            (window as any).testAudioFiles = async () => {
                console.log('🧪 Testing all audio files...');
                const sounds = ['flute', 'healing', 'om', 'rain', 'waves'];
                const results: Record<string, any> = {};
                
                for (const sound of sounds) {
                    const asset = getSoundAsset(sound);
                    if (!asset) {
                        results[sound] = { status: 'NOT_FOUND' };
                        continue;
                    }
                    
                    try {
                        const audio = new Audio();
                        audio.crossOrigin = 'anonymous';
                        
                        const result: any = {
                            status: 'TESTING',
                            url: asset.uri
                        };
                        
                        const timeout = new Promise(resolve => {
                            setTimeout(() => {
                                result.status = 'TIMEOUT';
                                resolve(null);
                            }, 5000);
                        });
                        
                        const load = new Promise(resolve => {
                            audio.oncanplay = () => {
                                result.status = 'SUCCESS';
                                result.duration = audio.duration;
                                resolve(true);
                            };
                            audio.onerror = () => {
                                const errorCode = audio.error?.code;
                                const errorTypes: Record<number, string> = {
                                    1: 'ABORTED',
                                    2: 'NETWORK_ERROR',
                                    3: 'DECODE_ERROR',
                                    4: 'NOT_SUPPORTED'
                                };
                                result.status = errorTypes[errorCode as number] || 'ERROR';
                                resolve(false);
                            };
                            audio.src = asset.uri;
                            audio.load();
                        });
                        
                        await Promise.race([timeout, load]);
                        results[sound] = result;
                        
                        console.log(`${result.status === 'SUCCESS' ? '✅' : '❌'} ${sound}: ${result.status}`);
                    } catch (e) {
                        results[sound] = { status: 'ERROR', error: String(e) };
                        console.error(`❌ ${sound}: ${e}`);
                    }
                }
                
                console.log('📊 Audio Test Results:', JSON.stringify(results, null, 2));
                return results;
            };
            
            (window as any).debugAudio = () => {
                console.log('🔍 Audio Debug Info:');
                console.log('Current sound setting:', settings.soundType);
                console.log('Web audio ref exists:', !!webAudioRef.current);
                console.log('Web audio paused:', webAudioRef.current?.paused);
                console.log('Web audio volume:', webAudioRef.current?.volume);
                console.log('Web audio src:', webAudioRef.current?.src);
                console.log('Ambient playing:', isAmbientPlaying);
                console.log('===');
                if (webAudioRef.current) {
                    console.log('Audio readyState:', webAudioRef.current.readyState, '(3=can play through)');
                    console.log('Audio networkState:', webAudioRef.current.networkState, '(3=loaded)');
                    console.log('Audio error:', webAudioRef.current.error);
                }
            };
            
            (window as any).playAudioManually = (soundName: string = 'flute') => {
                console.log(`🔊 Manually playing: ${soundName}`);
                const asset = getSoundAsset(soundName);
                if (!asset) {
                    console.error(`Not found: ${soundName}`);
                    return;
                }
                
                if (!webAudioRef.current) {
                    const audio = document.createElement('audio');
                    audio.crossOrigin = 'anonymous';
                    audio.loop = true;
                    audio.volume = 0.3;
                    document.body.appendChild(audio);
                    webAudioRef.current = audio;
                }
                
                webAudioRef.current.src = asset.uri;
                webAudioRef.current.volume = 0.3;
                console.log(`Src set to: ${asset.uri}`);
                
                webAudioRef.current.play().then(() => {
                    console.log(`✅ Playing: ${soundName}`);
                }).catch(err => {
                    console.error(`❌ Play failed: ${err.message}`);
                });
            };
            
            console.log('💡 Available test commands:');
            console.log('  window.testAudioFiles() - Test all audio files');
            console.log('  window.debugAudio() - Debug current audio state');
            console.log('  window.playAudioManually("flute") - Manually play a sound');
        }
    }, [settings.soundType]);

    const playVoice = async (text: string, base64Audio?: string | null) => {
        if (voiceSound) {
            if (Platform.OS !== 'web' && Audio) {
                await voiceSound.unloadAsync();
            }
            setVoiceSound(null);
        }
        Speech.stop();

        if (!settings.voiceEnabled) return;

        // Calming voice settings for mental wellness
        const getVoiceSettings = () => {
            // Speed mapping: very-slow for deep relaxation, slow for calm, normal for regular
            const rateMap = {
                'very-slow': 0.6,  // Deep meditation pace
                'slow': 0.75,      // Calm, soothing pace
                'normal': 0.85     // Slightly slower than default for comfort
            };

            // Pitch based on voice style - lower pitch is more calming
            const pitchMap = {
                'gentle': 0.95,    // Soft, nurturing tone
                'deep': 0.8,       // Deep, grounding voice
                'soft': 1.0        // Natural, warm tone
            };

            return {
                language: settings.language === 'hi' ? 'hi-IN' : 'en-IN',
                rate: rateMap[settings.voiceSpeed as keyof typeof rateMap] || 0.75,
                pitch: pitchMap[settings.voiceStyle as keyof typeof pitchMap] || 0.95,
                volume: settings.volume || 0.8,
                onStart: () => setIsVoiceSpeaking(true),
                onDone: () => setIsVoiceSpeaking(false),
                onStopped: () => setIsVoiceSpeaking(false),
                onError: () => setIsVoiceSpeaking(false),
            };
        };

        if (base64Audio && Audio) {
            try {
                const uri = `data:audio/mp3;base64,${base64Audio}`;
                const { sound: newVoice } = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: true, volume: Math.min(settings.volume || 0.8, AUDIO_CONFIG.voice.volume) },
                    (status: any) => {
                        if (status.isLoaded) {
                            if (status.isPlaying) setIsVoiceSpeaking(true);
                            if (status.didJustFinish) setIsVoiceSpeaking(false);
                        }
                    }
                );
                setVoiceSound(newVoice);
            } catch (e) {
                console.log("Failed to play base64, using system TTS", e);
                Speech.speak(text, getVoiceSettings());
            }
        } else {
            // Use enhanced calming voice settings
            Speech.speak(text, getVoiceSettings());
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        // Optional: Pause ambient when sending (if desired, but user might want it background)
        // If we want to pause: 
        // if (isAmbientPlaying) setIsAmbientPlaying(false);

        try {
            const aiText = await getAIResponse(userMsg.content, messages.map(m => ({ role: m.role, content: m.content })), settings.language);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: aiText,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);
            setIsLoading(false);

            if (settings.voiceEnabled) {
                // Try Sarvam AI first for best quality, then fallback to Gemini flash
                let audioData = await getSarvamTTS(aiText, settings.language, {
                    voiceSpeed: settings.voiceSpeed,
                });
                
                if (!audioData) {
                    audioData = await getGeminiTTS(aiText, settings.voiceStyle, settings.language);
                }
                
                playVoice(aiText, audioData);
            }

        } catch (error) {
            console.error(error);
            setIsLoading(false);
            setMessages(prev => [...prev, { id: 'err', role: 'ai', content: getTranslation(settings.language, 'errors.connection'), timestamp: Date.now() }]);
        }
    };

    const renderItem = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
                <View style={[styles.bubble, isUser ? [styles.userBubble, dynamicStyles.userBubbleBg] : [styles.aiBubble, dynamicStyles.aiBubbleBg]]}>
                    <Text style={[styles.messageText, isUser ? [styles.userText, dynamicStyles.userText] : [styles.aiText, dynamicStyles.aiText]]}>
                        {item.content}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, dynamicStyles.containerBg]}>
            {/* Krishna Background Layer - Centered */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[styles.centerContent, { marginTop: -60 }]}>
                    <Animated.View style={{ 
                        opacity: krishnaOpacity, 
                        transform: [{ scale: scaleAnim }],
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%'
                    }}>
                        
                        {/* Platform-specific rendering */}
                        {Platform.OS === 'web' ? (
                            // Web: Use HTML5 video as full background
                            <video
                                ref={webVideoRef}
                                autoPlay
                                muted
                                loop
                                playsInline
                                style={{
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    zIndex: 1
                                } as any}
                                onError={() => console.error('[ChatInterface] Video failed to load:', KRISHNA_VIDEO_URL)}
                            >
                                <source src={KRISHNA_VIDEO_URL} type="video/mp4" />
                            </video>
                        ) : (
                            // Mobile: Use video component
                            <Video
                                source={{ uri: KRISHNA_VIDEO_URL }}
                                rate={1.0}
                                volume={0}
                                isMuted={true}
                                isLooping={true}
                                shouldPlay={settings.krishnaMode || isLoading || isVoiceSpeaking}
                                style={{...styles.krishnaImage, position: 'absolute', width: '100%', height: '100%'} as any}
                                resizeMode={"cover" as any}
                            />
                        )}
                        
                        {/* Overlay for better text contrast */}
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.15)', zIndex: 2 }]} />
                    </Animated.View>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardContainer}
            >
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, dynamicStyles.accentColor]}>Dharma AI</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={toggleAmbient} style={styles.iconButton}>
                            {isAmbientPlaying ? <Volume2 color={theme.colors.accent} size={24} /> : <VolumeX color={theme.colors.muted} size={24} />}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onOpenSettings} style={styles.iconButton}>
                            <Settings color={theme.colors.muted} size={24} />
                        </TouchableOpacity>
                    </View>
                </View>

                <FlatList
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    style={styles.list}
                />

                {isLoading && (
                    <View style={[styles.bubble, styles.aiBubble, dynamicStyles.aiBubbleBg, { marginLeft: 20, marginBottom: 20, width: 60, alignItems: 'center' }]}>
                        <Text style={[{ fontSize: 20 }, dynamicStyles.accentColor]}>...</Text>
                    </View>
                )}

                <View style={styles.inputWrapper}>
                    <BlurView intensity={30} tint={theme.isDark ? "dark" : "light"} style={[styles.inputContainer, dynamicStyles.inputBg, dynamicStyles.inputBorder]}>
                        <TextInput
                            style={[styles.input, dynamicStyles.textColor]}
                            value={input}
                            onChangeText={setInput}
                            placeholder={getTranslation(settings.language, 'placeholder')}
                            placeholderTextColor={theme.colors.muted}
                            multiline
                        />
                        <View style={styles.actionButtons}>
                            {/* Mic icon could go here if implemented */}
                            {/* Note icon for sound toggle */}
                            <Music size={20} color={theme.colors.accent} style={{ opacity: 0.5, marginRight: 10 }} />

                            <TouchableOpacity onPress={handleSend} disabled={!input.trim() || isLoading} style={[styles.sendButton, dynamicStyles.sendButtonBg]}>
                                {isLoading ? <ActivityIndicator size="small" color={dynamicStyles.sendButtonLoader} /> : <Send color={dynamicStyles.sendButtonLoader} size={18} />}
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 22,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    iconButton: {
        padding: 8,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 120, // Space for floating input
        paddingTop: 10,
    },
    messageRow: {
        marginBottom: 20,
        width: '100%',
        flexDirection: 'row',
    },
    userRow: {
        justifyContent: 'flex-end',
    },
    aiRow: {
        justifyContent: 'flex-start',
    },
    bubble: {
        padding: 20,
        borderRadius: 24,
        overflow: 'hidden',
    },
    userBubble: {
        maxWidth: '70%',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        maxWidth: '90%',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
    },
    userText: {
    },
    aiText: {
        fontFamily: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
        fontSize: 18,
        lineHeight: 28,
        fontStyle: 'italic',
    },
    inputWrapper: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        borderRadius: 35,
        overflow: 'hidden',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 35,
        borderWidth: 1,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        fontSize: 16,
        marginRight: 10,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    krishnaImage: {
        width: 320,
        height: 320,
        borderRadius: 160,
    },
    halo: {
        position: 'absolute',
        width: 380,
        height: 380,
        borderRadius: 190,
        opacity: 0.2, // Subtle golden glow
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 50,
        elevation: 20, // Android glow attempt
    }
});
