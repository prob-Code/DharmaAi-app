// Avatar Component - Displays user avatar with fallback
import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { User as UserIcon } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';

interface AvatarProps {
    uri?: string;
    name?: string;
    size?: 'small' | 'medium' | 'large';
    isAnonymous?: boolean;
}

const SIZES = {
    small: 32,
    medium: 48,
    large: 80,
};

export const Avatar: React.FC<AvatarProps> = ({
    uri,
    name = '',
    size = 'medium',
    isAnonymous = false
}) => {
    const { theme } = useTheme();
    const dimension = SIZES[size];
    const fontSize = dimension * 0.4;

    // Get initials from name
    const getInitials = (name: string) => {
        if (isAnonymous) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Generate consistent color from name
    const getColor = (name: string) => {
        if (isAnonymous) return theme.colors.muted;
        const colors = [theme.colors.accent, '#4CAF50', '#2196F3', '#9C27B0', '#FF5722', '#00BCD4'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    if (uri && !isAnonymous) {
        return (
            <Image
                source={{ uri }}
                style={[
                    styles.avatar,
                    { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: theme.colors.surfaceHighlight }
                ]}
            />
        );
    }

    return (
        <View
            style={[
                styles.fallback,
                {
                    width: dimension,
                    height: dimension,
                    borderRadius: dimension / 2,
                    backgroundColor: getColor(name)
                }
            ]}
        >
            {isAnonymous ? (
                <UserIcon size={dimension * 0.5} color="#fff" />
            ) : (
                <Text style={[styles.initials, { fontSize }]}>
                    {getInitials(name)}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    avatar: {
    },
    fallback: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    initials: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

export default Avatar;
