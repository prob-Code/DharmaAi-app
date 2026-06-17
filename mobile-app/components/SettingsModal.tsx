import React from 'react';
import { View, Text, Switch, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { X, Check, RotateCcw } from 'lucide-react-native';
import { UserSettings, SoundType, Language } from '../src/types';
import { getTranslation } from '../translations';
import { COLORS } from '../constants';
import { useTheme } from '../context/ThemeContext';

interface Props {
    visible: boolean;
    onClose: () => void;
    settings: UserSettings;
    onUpdateSettings: (settings: Partial<UserSettings>) => void;
    onReset?: () => void;
    onSignOut?: () => void;
}

export const SettingsModal: React.FC<Props> = ({ visible, onClose, settings, onUpdateSettings, onReset, onSignOut }) => {
    const { theme, mode, setMode } = useTheme();

    const handleResetApp = () => {
        Alert.alert(
            'Reset App',
            'This will clear all data and restart the onboarding. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AsyncStorage.clear();
                            onClose();
                            if (onReset) {
                                onReset();
                            }
                        } catch (error) {
                            console.error('Error clearing storage:', error);
                        }
                    }
                }
            ]
        );
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <BlurView intensity={90} tint={theme.isDark ? 'dark' : 'light'} style={styles.container}>
                <View style={[styles.content, { backgroundColor: theme.isDark ? '#1A2926' : theme.colors.surface }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.accent }]}>{getTranslation(settings.language, 'settings.title')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={theme.colors.muted} size={24} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>

                        {/* Language */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.colors.text }]}>{getTranslation(settings.language, 'settings.language')}</Text>
                            <View style={styles.row}>
                                <TouchableOpacity
                                    onPress={() => onUpdateSettings({ language: 'en' })}
                                    style={[styles.optionBtn, settings.language === 'en' && styles.optionBtnActive]}
                                >
                                    <Text style={[styles.optionText, { color: theme.colors.text }, settings.language === 'en' && styles.optionTextActive]}>English</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => onUpdateSettings({ language: 'hi' })}
                                    style={[styles.optionBtn, settings.language === 'hi' && styles.optionBtnActive]}
                                >
                                    <Text style={[styles.optionText, { color: theme.colors.text }, settings.language === 'hi' && styles.optionTextActive]}>हिंदी</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Theme */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.colors.text }]}>Theme</Text>
                            <View style={styles.row}>
                                {([
                                    { key: 'system', label: 'System' },
                                    { key: 'light', label: 'Light' },
                                    { key: 'dark', label: 'Dark' },
                                ] as const).map((opt) => (
                                    <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => setMode(opt.key)}
                                        style={[styles.optionBtn, mode === opt.key && styles.optionBtnActive]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Theme: ${opt.label}`}
                                    >
                                        <Text
                                            style={[
                                                styles.optionText,
                                                { color: theme.colors.text },
                                                mode === opt.key && styles.optionTextActive,
                                            ]}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Voice Toggle */}
                        <View style={styles.switchRow}>
                            <View>
                                <Text style={[styles.label, { color: theme.colors.text }]}>{getTranslation(settings.language, 'settings.voice')}</Text>
                                <Text style={[styles.subLabel, { color: theme.colors.muted }]}>{getTranslation(settings.language, 'settings.voiceDesc')}</Text>
                            </View>
                            <Switch
                                value={settings.voiceEnabled}
                                onValueChange={(v) => onUpdateSettings({ voiceEnabled: v })}
                                trackColor={{ false: theme.isDark ? '#333' : '#ddd', true: theme.colors.accent }}
                                thumbColor="#fff"
                            />
                        </View>

                        {/* Voice Style */}
                        {settings.voiceEnabled && (
                            <View style={styles.section}>
                                <Text style={styles.label}>{getTranslation(settings.language, 'settings.style')}</Text>
                                <View style={styles.row}>
                                    {(['gentle', 'deep', 'soft'] as const).map(style => (
                                        <TouchableOpacity
                                            key={style}
                                            onPress={() => onUpdateSettings({ voiceStyle: style })}
                                            style={[styles.optionBtn, settings.voiceStyle === style && styles.optionBtnActive]}
                                        >
                                            <Text style={[styles.optionText, settings.voiceStyle === style && styles.optionTextActive]}>
                                                {getTranslation(settings.language, `settings.styles.${style}`)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Voice Speed - Calming Pace for Mental Wellness */}
                        {settings.voiceEnabled && (
                            <View style={styles.section}>
                                <Text style={styles.label}>🧘 Calming Pace</Text>
                                <Text style={styles.subLabel}>Slower voices are more soothing</Text>
                                <View style={[styles.row, { marginTop: 12 }]}>
                                    <TouchableOpacity
                                        onPress={() => onUpdateSettings({ voiceSpeed: 'very-slow' })}
                                        style={[styles.optionBtn, settings.voiceSpeed === 'very-slow' && styles.optionBtnActive]}
                                    >
                                        <Text style={[styles.optionText, settings.voiceSpeed === 'very-slow' && styles.optionTextActive]}>
                                            🌙 Very Slow
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => onUpdateSettings({ voiceSpeed: 'slow' })}
                                        style={[styles.optionBtn, settings.voiceSpeed === 'slow' && styles.optionBtnActive]}
                                    >
                                        <Text style={[styles.optionText, settings.voiceSpeed === 'slow' && styles.optionTextActive]}>
                                            🌿 Slow
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => onUpdateSettings({ voiceSpeed: 'normal' })}
                                        style={[styles.optionBtn, settings.voiceSpeed === 'normal' && styles.optionBtnActive]}
                                    >
                                        <Text style={[styles.optionText, settings.voiceSpeed === 'normal' && styles.optionTextActive]}>
                                            ☀️ Normal
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Sound */}
                        <View style={styles.section}>
                            <Text style={styles.label}>{getTranslation(settings.language, 'settings.sound')}</Text>
                            <View style={styles.grid}>
                                {(['flute', 'rain', 'waves', 'om', 'healing', 'silence'] as const).map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        onPress={() => onUpdateSettings({ soundType: type })}
                                        style={[styles.gridBtn, settings.soundType === type && styles.gridBtnActive]}
                                    >
                                        <Text style={[styles.gridText, settings.soundType === type && styles.gridTextActive]}>
                                            {getTranslation(settings.language, `sounds.${type}`)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Reset App Button */}
                        <TouchableOpacity style={styles.resetButton} onPress={handleResetApp}>
                            <RotateCcw color="#ff6b6b" size={20} />
                            <Text style={styles.resetText}>Reset App & Restart Onboarding</Text>
                        </TouchableOpacity>

                        {/* Sign Out Button */}
                        {onSignOut && (
                            <TouchableOpacity style={styles.signOutButton} onPress={() => {
                                Alert.alert(
                                    'Sign Out',
                                    'Are you sure you want to sign out?',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Sign Out',
                                            style: 'destructive',
                                            onPress: () => {
                                                onClose();
                                                onSignOut();
                                            }
                                        }
                                    ]
                                );
                            }}>
                                <Text style={styles.signOutText}>Sign Out</Text>
                            </TouchableOpacity>
                        )}

                    </ScrollView>
                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#1A2926',
        height: '80%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 24,
        color: COLORS.accent,
        fontWeight: 'bold',
        fontFamily: 'System', // serif usually
    },
    closeBtn: {
        padding: 5,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 12,
        fontWeight: '600',
    },
    subLabel: {
        color: COLORS.muted,
        fontSize: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    optionBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    optionBtnActive: {
        backgroundColor: 'rgba(197, 160, 89, 0.2)',
        borderColor: COLORS.accent,
    },
    optionText: {
        color: COLORS.muted,
        fontSize: 14,
    },
    optionTextActive: {
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    gridBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: 5,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    gridBtnActive: {
        backgroundColor: 'rgba(197, 160, 89, 0.2)',
        borderColor: COLORS.accent,
    },
    gridText: {
        color: COLORS.muted,
        fontSize: 12,
    },
    gridTextActive: {
        color: COLORS.accent,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        padding: 16,
        borderRadius: 12,
        marginTop: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.3)',
        gap: 10,
    },
    resetText: {
        color: '#ff6b6b',
        fontSize: 14,
        fontWeight: '600',
    },
    signOutButton: {
        alignItems: 'center',
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        marginTop: 10,
    },
    signOutText: {
        color: COLORS.muted,
        fontSize: 15,
        fontWeight: '500',
    }
});
