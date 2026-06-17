// Mood Tag Component - Displays mood with color coding
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MoodStatus, MOOD_COLORS } from '../../../types/social';
import { useTheme } from '../../../context/ThemeContext';

interface MoodTagProps {
    mood: MoodStatus;
    size?: 'small' | 'medium';
    onPress?: () => void;
    selected?: boolean;
}

const MOOD_LABELS: Record<MoodStatus, string> = {
    hopeful: '🌟 Hopeful',
    peaceful: '🌿 Peaceful',
    struggling: '🌧️ Struggling',
    grateful: '🙏 Grateful',
    anxious: '💭 Anxious',
    healing: '🌱 Healing',
    growing: '🌻 Growing',
    neutral: '☁️ Neutral',
};

export const MoodTag: React.FC<MoodTagProps> = ({
    mood,
    size = 'medium',
    onPress,
    selected = false
}) => {
    const { theme } = useTheme();
    const color = MOOD_COLORS[mood];
    const isSmall = size === 'small';

    const content = (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: `${color}20`,
                    borderColor: selected ? color : theme.colors.surfaceHighlight,
                    paddingVertical: isSmall ? 4 : 6,
                    paddingHorizontal: isSmall ? 8 : 12,
                }
            ]}
        >
            <Text style={[styles.text, { color, fontSize: isSmall ? 10 : 12 }]}>
                {MOOD_LABELS[mood]}
            </Text>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        borderWidth: 1.5,
        alignSelf: 'flex-start',
    },
    text: {
        fontWeight: '600',
    },
});

export default MoodTag;
