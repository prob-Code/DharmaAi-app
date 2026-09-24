import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { ResearchButton } from './ResearchButton';
import { displayFont, researchPalette } from './researchTheme';

// Calm, quiet states. No spinners for full-surface loading beyond a small,
// restrained indicator.

interface StateShellProps {
  title: string;
  body?: string;
  children?: React.ReactNode;
}

const StateShell: React.FC<StateShellProps> = ({ title, body, children }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.shell, { opacity }]}>
      <Text style={styles.title} maxFontSizeMultiplier={1.25}>
        {title}
      </Text>
      {body ? (
        <Text style={styles.body} maxFontSizeMultiplier={1.2}>
          {body}
        </Text>
      ) : null}
      {children}
    </Animated.View>
  );
};

interface LoadingStateProps {
  title?: string;
  body?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'A quiet moment',
  body = 'Setting things up for you.',
}) => {
  return (
    <View style={styles.shell}>
      <ActivityIndicator size="small" color={researchPalette.accent} />
      <Text style={styles.inlineTitle} maxFontSizeMultiplier={1.25}>
        {title}
      </Text>
      {body ? (
        <Text style={styles.inlineBody} maxFontSizeMultiplier={1.2}>
          {body}
        </Text>
      ) : null}
    </View>
  );
};

interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  loading?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something interrupted',
  body = 'Nothing is lost. Take a breath, and we can try again.',
  onRetry,
  retryLabel = 'Try again',
  loading = false,
}) => {
  return (
    <StateShell title={title} body={body}>
      {onRetry ? (
        <View style={styles.action}>
          <ResearchButton
            label={loading ? 'One moment…' : retryLabel}
            onPress={onRetry}
            variant="secondary"
            loading={loading}
            disabled={loading}
          />
        </View>
      ) : null}
    </StateShell>
  );
};

interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  body,
  actionLabel,
  onAction,
}) => {
  return (
    <StateShell title={title} body={body}>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <ResearchButton label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </StateShell>
  );
};

const centeredText = {
  textAlign: 'center' as const,
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    fontFamily: displayFont,
    color: researchPalette.text,
    ...centeredText,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: researchPalette.muted,
    ...centeredText,
  },
  inlineTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    fontFamily: displayFont,
    color: researchPalette.text,
    ...centeredText,
  },
  inlineBody: {
    fontSize: 14,
    lineHeight: 21,
    color: researchPalette.muted,
    ...centeredText,
  },
  action: {
    marginTop: 14,
    alignSelf: 'stretch',
  },
});