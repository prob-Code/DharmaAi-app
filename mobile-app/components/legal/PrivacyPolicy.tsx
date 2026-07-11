import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface Props {
    onClose: () => void;
}

export const PrivacyPolicy: React.FC<Props> = ({ onClose }) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.accent }]}>Privacy Policy</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X color={theme.colors.muted} size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.lastUpdated, { color: theme.colors.muted }]}>
                    Last updated: July 11, 2026
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    1. Introduction
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    DharmaAI: Inner Balance ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    2. Information We Collect
                </Text>
                <Text style={[styles.subTitle, { color: theme.colors.text }]}>
                    Personal Information
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    • Email address (for account creation){'\n'}
                    • Display name / username{'\n'}
                    • Google account information (if using Google Sign-In){'\n'}
                    • Profile information you voluntarily provide
                </Text>

                <Text style={[styles.subTitle, { color: theme.colors.text }]}>
                    Usage Data
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    • Chat conversations with the AI companion{'\n'}
                    • Stress analysis responses and reports{'\n'}
                    • App settings and preferences{'\n'}
                    • Community posts and interactions{'\n'}
                    • Reflection journal entries
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    3. How We Use Your Information
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    We use the information we collect to:{'\n\n'}
                    • Provide and maintain the AI companion service{'\n'}
                    • Generate personalized wellness insights and stress reports{'\n'}
                    • Enable community features (posts, comments, messaging){'\n'}
                    • Improve and optimize the app experience{'\n'}
                    • Send push notifications (with your consent){'\n'}
                    • Authenticate your identity and secure your account
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    4. AI-Powered Features
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    Our app uses AI language models to provide conversational wellness support. Your chat messages are processed by third-party AI services (Google Gemini, Groq) to generate responses. These conversations are not used to train AI models. Chat data is stored locally on your device and in our secure database for your personal use.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    5. Data Storage and Security
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    Your data is stored securely using Supabase, a trusted cloud database provider. All data transmission is encrypted using HTTPS/TLS. We implement industry-standard security measures to protect your personal information. However, no method of electronic storage is 100% secure.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    6. Data Sharing
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    We do not sell, trade, or rent your personal information to third parties. We may share data with:{'\n\n'}
                    • Service providers (Supabase for database, Google for authentication){'\n'}
                    • AI service providers (for processing chat conversations){'\n'}
                    • Law enforcement (if required by law){'\n\n'}
                    Community posts and comments you make are visible to other users as intended by the feature.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    7. Your Rights
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    You have the right to:{'\n\n'}
                    • Access your personal data{'\n'}
                    • Correct inaccurate data{'\n'}
                    • Delete your account and associated data{'\n'}
                    • Export your data{'\n'}
                    • Opt out of push notifications{'\n\n'}
                    To exercise these rights, use the "Delete Account" option in Settings or contact us at dharmaai.app@gmail.com.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    8. Account Deletion
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    You can delete your account at any time from the Settings screen. When you delete your account:{'\n\n'}
                    • Your profile information is permanently removed{'\n'}
                    • Your posts and comments are deleted{'\n'}
                    • Your chat history is erased{'\n'}
                    • Your stress reports are deleted{'\n'}
                    • This action cannot be undone
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    9. Children's Privacy
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    DharmaAI is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will take steps to delete it.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    10. Changes to This Policy
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    We may update this Privacy Policy from time to time. Changes will be reflected in the app and the "Last updated" date will be revised. Continued use of the app after changes constitutes acceptance of the new policy.
                </Text>

                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    11. Contact Us
                </Text>
                <Text style={[styles.body, { color: theme.colors.muted }]}>
                    If you have questions about this Privacy Policy, please contact us at:{'\n\n'}
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
    subTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 6,
    },
    body: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 8,
    },
});
