import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface Props {
    onClose: () => void;
}

export const TermsOfService: React.FC<Props> = ({ onClose }) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.accent }]}>Terms of Service</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X color={theme.colors.muted} size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.lastUpdated, { color: theme.colors.muted }]}>
                    Last updated: July 11, 2026
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    1. Acceptance of Terms
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    By downloading, installing, or using DharmaAI: Inner Balance ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    2. Description of Service
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    DharmaAI is an AI-powered wellness companion that provides:{'\n\n'}
                    • Conversational support inspired by Bhagavad Gita wisdom{'\n'}
                    • Stress analysis and wellness reports{'\n'}
                    • Meditation and calming sounds{'\n'}
                    • Community features for shared wellness journeys{'\n'}
                    • Spiritual reflection journaling
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    3. Important Disclaimer — Not Medical Advice
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    DharmaAI is NOT a substitute for professional medical advice, diagnosis, or treatment. The AI companion provides general wellness guidance based on spiritual texts and should not be relied upon for medical or psychiatric decisions.{'\n\n'}
                    If you are experiencing a mental health crisis, please contact:{'\n'}
                    • Emergency services (911 or your local equivalent){'\n'}
                    • National Suicide Prevention Lifeline: 988{'\n'}
                    • Crisis Text Line: Text HOME to 741741{'\n'}
                    • Vandrevala Foundation (India): 1860-2662-345
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    4. User Accounts
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    • You must be at least 18 years old to create an account{'\n'}
                    • You are responsible for maintaining the confidentiality of your account{'\n'}
                    • You are responsible for all activities under your account{'\n'}
                    • You must provide accurate information during registration{'\n'}
                    • We reserve the right to suspend accounts that violate these terms
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    5. Acceptable Use
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    You agree not to:{'\n\n'}
                    • Post harmful, abusive, or hateful content in the community{'\n'}
                    • Harass other users{'\n'}
                    • Share misleading medical or health advice{'\n'}
                    • Attempt to reverse-engineer or hack the App{'\n'}
                    • Use the App for any illegal purpose{'\n'}
                    • Create multiple accounts to circumvent bans
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    6. AI-Generated Content
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    The AI companion generates responses using artificial intelligence. These responses:{'\n\n'}
                    • May not always be accurate or appropriate{'\n'}
                    • Are for informational and spiritual guidance purposes only{'\n'}
                    • Should not replace professional advice{'\n'}
                    • Are generated by third-party AI services (Google, Groq){'\n\n'}
                    We do not guarantee the accuracy, completeness, or usefulness of AI-generated content.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    7. Community Guidelines
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    When using community features:{'\n\n'}
                    • Be respectful and compassionate{'\n'}
                    • Do not share personal medical information of others{'\n'}
                    • Anonymous posts are still subject to these terms{'\n'}
                    • We may remove content that violates these guidelines{'\n'}
                    • Repeated violations will result in account suspension
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    8. Intellectual Property
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    The App, including its design, code, graphics, and content, is owned by DharmaAI and protected by intellectual property laws. You may not copy, modify, or distribute any part of the App without our written permission.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    9. Account Termination
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    You may delete your account at any time through the Settings screen. We may also terminate your account if you violate these Terms. Upon termination, your data will be deleted in accordance with our Privacy Policy.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    10. Limitation of Liability
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    To the fullest extent permitted by law, DharmaAI shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App. Our total liability shall not exceed the amount paid by you for the App (which is zero for the free version).
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    11. Changes to Terms
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    We reserve the right to modify these Terms at any time. Changes will be effective upon posting in the App. Your continued use of the App constitutes acceptance of the modified Terms.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    12. Contact Us
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    If you have questions about these Terms, please contact us at:{'\n\n'}
                    Email: dharmaai.app@gmail.com
                </Text>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 5,
    },
    scrollContent: {
        flex: 1,
    },
    lastUpdated: {
        fontSize: 12,
        marginBottom: 20,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 8,
    },
    body: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 8,
    },
});
