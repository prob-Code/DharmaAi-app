import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { researchPalette } from './researchTheme';

export type ResearchButtonVariant = 'primary' | 'secondary' | 'ghost';

type VariantStyles = {
  shell: ViewStyle;
  label: TextStyle;
};

interface Props {
  label: string;
  onPress: () => void;
  variant?: ResearchButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export const ResearchButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
  style,
}) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].shell,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? researchPalette.accentText : researchPalette.accent}
          testID={testID ? `${testID}-loading` : undefined}
        />
      ) : (
        <Text
          accessibilityRole={undefined}
          style={[styles.label, variantStyles[variant].label]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

const variantStyles: Record<ResearchButtonVariant, VariantStyles> = {
  primary: {
    shell: {
      backgroundColor: researchPalette.accent,
    },
    label: {
      color: researchPalette.accentText,
    },
  },
  secondary: {
    shell: {
      backgroundColor: researchPalette.surfaceRaised,
      borderWidth: 1,
      borderColor: researchPalette.border,
    },
    label: {
      color: researchPalette.text,
    },
  },
  ghost: {
    shell: {
      backgroundColor: 'transparent',
    },
    label: {
      color: researchPalette.muted,
      fontWeight: '500',
    },
  },
};