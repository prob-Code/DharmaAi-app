import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { ChevronRight } from 'lucide-react-native';
import { UserSettings, Language } from '../src/types';
import { getTranslation } from '../translations';
import { ONBOARDING_QUESTIONS } from '../constants';


interface Props {
    onComplete: (name: string) => void;
    settings: UserSettings;
    onUpdateSettings: (settings: Partial<UserSettings>) => void;
}

export const Onboarding: React.FC<Props> = ({ onComplete, settings, onUpdateSettings }) => {
    const [step, setStep] = useState(-1);
    const [name, setName] = useState('');
    const [isFinishing, setIsFinishing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
        }).start();
    }, [step]);

    const handleNext = () => {
        if (step === 0 && !name.trim()) setName('Friend');

        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
        }).start(() => {
            if (step < ONBOARDING_QUESTIONS.length - 1) {
                setStep(step + 1);
                fadeAnim.setValue(0);
                Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
            } else {
                setIsFinishing(true);
                setTimeout(() => onComplete(name || 'Friend'), 1500);
            }
        });
    };

    const handleLanguageSelect = (lang: 'en' | 'hi') => {
        onUpdateSettings({ language: lang });
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
        }).start(() => {
            setStep(0);
            fadeAnim.setValue(0);
            Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
        });
    };

    // Language Selection
    if (step === -1) {
        return (
            <View style={styles.container}>
                <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                    {/* Step 1 indicator for language? Screenshots don't show it for language, but do for name. 
                         Actually screenshot 1 is 'Step 1 of 7' -> Name.
                         So Language is Step 0 or separate?
                         User's screenshot 1 shows 'Choose your language'. No step count.
                         User's screenshot 2 shows 'STEP 1 OF 7' -> 'What name...'.
                         So Language is indeed separate (-1 in my logic).
                     */}
                    <Text style={[styles.title, { marginBottom: 40 }]}>{getTranslation(settings.language, 'onboarding.chooseLanguage')}</Text>

                    <View style={styles.langContainer}>
                        <TouchableOpacity onPress={() => handleLanguageSelect('en')} style={styles.langButton}>
                            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                            <Text style={styles.langTitle}>English</Text>
                            <Text style={styles.langSubtitle}>LANGUAGE</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleLanguageSelect('hi')} style={styles.langButton}>
                            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                            <Text style={styles.langTitle}>हिंदी</Text>
                            <Text style={styles.langSubtitle}>भाषा</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        );
    }

    // Finishing
    if (isFinishing) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>{getTranslation(settings.language, 'onboarding.preparing')}</Text>
            </View>
        );
    }

    // Question Flow
    return (
        <View style={styles.container}>
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <Text style={styles.stepText}>
                    {getTranslation(settings.language, 'onboarding.step')} {step + 1} {getTranslation(settings.language, 'onboarding.of')} {ONBOARDING_QUESTIONS.length}
                </Text>

                <Text style={styles.questionText}>
                    {/* Use imported questions */}
                    {ONBOARDING_QUESTIONS[step]}
                </Text>

                <View style={styles.inputContainer}>
                    {step === 0 ? (
                        <TextInput
                            style={styles.input}
                            placeholder={getTranslation(settings.language, 'onboarding.placeholder')}
                            placeholderTextColor="#666"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    ) : (
                        <TouchableOpacity onPress={handleNext} style={styles.skipButton}>
                            <Text style={styles.skipText}>{getTranslation(settings.language, 'onboarding.skip')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity onPress={handleNext} style={styles.continueButton}>
                    <Text style={styles.continueText}>{getTranslation(settings.language, 'onboarding.continue')}</Text>
                    <ChevronRight size={20} color="#000" />
                </TouchableOpacity>

                <Text style={styles.noteText}>{getTranslation(settings.language, 'onboarding.note')}</Text>

            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#121C1A',
    },
    content: {
        width: '100%',
        alignItems: 'center',
        gap: 30,
    },
    title: {
        fontSize: 32,
        color: '#d4af37',
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        textAlign: 'center',
    },
    langContainer: {
        flexDirection: 'column', // Changed to column
        gap: 20,
        width: '100%',
        alignItems: 'center',
    },
    langButton: {
        width: '80%', // Wider button
        height: 100,
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    langTitle: {
        fontSize: 24,
        color: '#d4af37',
        marginBottom: 5,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    langSubtitle: {
        fontSize: 10,
        color: '#768783',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    stepText: {
        fontSize: 12,
        color: '#768783',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    questionText: {
        fontSize: 32, // Large Serif
        color: '#d4af37',
        textAlign: 'center',
        lineHeight: 44,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    inputContainer: {
        minHeight: 80,
        justifyContent: 'center',
        width: '100%',
        alignItems: 'center',
        marginVertical: 20,
    },
    input: {
        width: '80%',
        fontSize: 28,
        color: '#e0e0e0',
        borderBottomWidth: 1.5,
        borderBottomColor: '#d4af37',
        textAlign: 'center',
        paddingBottom: 10,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    skipButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    skipText: {
        color: '#768783',
        fontSize: 14,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d4af37',
        paddingVertical: 18,
        paddingHorizontal: 40,
        borderRadius: 50,
        gap: 10,
        elevation: 5,
    },
    continueText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '600',
    },
    noteText: {
        fontSize: 13,
        color: '#768783',
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 20,
        marginTop: 20,
    }
});
