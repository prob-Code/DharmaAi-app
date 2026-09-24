import React, { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import type { ResearchSnapshot } from '../../services/research/researchController';
import type { ParticipantResearchController } from '../../services/research/researchController';
import type { ResearchHydrationStatus } from '../../services/research/useParticipantResearch';
import { resolveResearchGateStep } from '../../services/research/researchGate';

interface ResearchGateProps {
  status: ResearchHydrationStatus;
  snapshot: ResearchSnapshot | null;
  controller: ParticipantResearchController | null;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export const ResearchGate: React.FC<ResearchGateProps> = ({
  status,
  snapshot,
  controller,
  error,
  onRetry,
  children,
}) => {
  const { theme } = useTheme();
  const [actionError, setActionError] = useState<string | null>(null);

  const step = resolveResearchGateStep(status, snapshot);

  if (step.step === 'session_active') {
    return <View style={styles.container}>{children}</View>;
  }

  const runAction = async (action: () => Promise<unknown> | undefined) => {
    if (controller === null) {
      return;
    }
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  };

  const renderAction = (label: string, onPress: () => void) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: theme.colors.accent }]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );

  const renderStep = () => {
    switch (step.step) {
      case 'hydrating':
        return (
          <View style={[styles.center, styles.placeholder, { backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={[styles.message, { color: theme.colors.text }]}>
              Checking your research journey...
            </Text>
          </View>
        );

      case 'unavailable':
        return (
          <Placeholder
            theme={theme}
            title="Research is unavailable"
            message={`The research experience could not be loaded.\n${errorMessage(error)}`}
            action={renderAction('Retry', onRetry)}
          />
        );

      case 'consent':
        return (
          <Placeholder
            theme={theme}
            title="Research consent"
            message="Before you begin, we need your informed consent to care for your mental wellness within the study protocol."
            action={renderAction(
              'I consent to begin',
              () => void runAction(() => controller?.recordConsent()),
            )}
          />
        );

      case 'entry':
        return (
          <Placeholder
            theme={theme}
            title="Welcome to your journey"
            message="You will begin with a short screening so we can confirm this program is right for you."
            action={renderAction(
              'Continue',
              () => void runAction(() => controller?.beginResearch()),
            )}
          />
        );

      case 'screening':
        return (
          <Placeholder
            theme={theme}
            title="Screening in progress"
            message="The screening questionnaire will appear in the next milestone. Once submitted, it will be reviewed before continuing."
          />
        );

      case 'not_eligible':
        return (
          <Placeholder
            theme={theme}
            title="Screening not eligible"
            message="Based on your screening, this program is not the right fit right now. Thank you for your honesty."
          />
        );

      case 'domain_discovery':
        return (
          <Placeholder
            theme={theme}
            title="Choosing your focus"
            message="The guided domain discovery will appear in the next milestone. You will select the single life area you want to focus on."
          />
        );

      case 'baseline_intro':
        return (
          <Placeholder
            theme={theme}
            title="Ready for the baseline"
            message="A short baseline questionnaire will establish your starting point before your sessions begin."
            action={renderAction(
              'Begin baseline',
              () => void runAction(() => controller?.beginBaseline()),
            )}
          />
        );

      case 'baseline_pending':
        return (
          <Placeholder
            theme={theme}
            title="Complete the baseline"
            message="The baseline questionnaire will appear in the next milestone. It is the score that marks your pre-program state."
          />
        );

      case 'sessions_entry':
        return (
          <Placeholder
            theme={theme}
            title="Your sessions are ready"
            message="Three guided sessions await you. Each one is a conversation focused on the life area you chose."
            action={renderAction(
              'Begin session 1',
              () => void runAction(() => controller?.startSessionOne('standard')),
            )}
          />
        );

      case 'session_next':
        return (
          <Placeholder
            theme={theme}
            title="Another session available"
            message="Your next session is ready whenever you are."
            action={renderAction(
              'Continue',
              () => void runAction(() => controller?.startNextSession('standard')),
            )}
          />
        );

      case 'post_test':
        return (
          <Placeholder
            theme={theme}
            title="You have completed your sessions"
            message="The post-test questionnaire, feedback, and completion review will appear in the next milestone."
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderStep()}
      {actionError !== null ? (
        <Text style={[styles.actionError, { color: theme.colors.muted }]}>{actionError}</Text>
      ) : null}
    </View>
  );
};

interface PlaceholderProps {
  theme: ReturnType<typeof useTheme>['theme'];
  title: string;
  message: string;
  action?: ReactNode;
}

const Placeholder: React.FC<PlaceholderProps> = ({ theme, title, message, action }) => (
  <View style={[styles.center, styles.placeholder, { backgroundColor: theme.colors.surface }]}>
    <Text style={[styles.title, { color: theme.colors.accent }]}>{title}</Text>
    <Text style={[styles.message, { color: theme.colors.text }]}>{message}</Text>
    {action}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 18,
  },
  placeholder: {
    borderRadius: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'serif',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginTop: 8,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  actionError: {
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: 13,
  },
});