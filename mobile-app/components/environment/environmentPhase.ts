// Presentation-only phase derivation for the ANANTA Companion environment.
// This is NOT a state machine and owns no state: the six phases are derived
// from existing read-only Companion visual inputs. INTERRUPTION is a
// transient phase driven by the PRIMARY presentation-only interruption
// signal; it never touches TTS or recording.

export interface EnvironmentInputs {
  listening: boolean;
  processing: boolean;
  speaking: boolean;
  interrupted: boolean;
  hasConversation: boolean;
}

export type EnvironmentPhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interruption'
  | 'text';

export function resolveEnvironmentPhase(
  inputs: EnvironmentInputs,
): EnvironmentPhase {
  if (inputs.interrupted) {
    return 'interruption';
  }
  if (inputs.speaking) {
    return 'speaking';
  }
  if (inputs.processing) {
    return 'processing';
  }
  if (inputs.listening) {
    return 'listening';
  }
  return inputs.hasConversation ? 'text' : 'idle';
}