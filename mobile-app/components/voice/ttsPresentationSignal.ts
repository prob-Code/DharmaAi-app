import { useSyncExternalStore } from 'react';

export type TtsPresentationPhase = 'normal' | 'interruption' | 'settling';

export const TTS_PRESENTATION_PHASE_DURATIONS = {
  interruption: 400,
  settling: 500,
} as const;

let phase: TtsPresentationPhase = 'normal';
let interruptionTimer: ReturnType<typeof setTimeout> | null = null;
let settlingTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function clearTimers(): void {
  if (interruptionTimer !== null) {
    clearTimeout(interruptionTimer);
    interruptionTimer = null;
  }
  if (settlingTimer !== null) {
    clearTimeout(settlingTimer);
    settlingTimer = null;
  }
}

function setPhase(next: TtsPresentationPhase): void {
  if (phase === next) {
    return;
  }
  phase = next;
  listeners.forEach((notify) => notify());
}

export function getTtsPresentationPhase(): TtsPresentationPhase {
  return phase;
}

export function signalTtsInterruption(): void {
  clearTimers();
  setPhase('interruption');
  interruptionTimer = setTimeout(() => {
    interruptionTimer = null;
    setPhase('settling');
    settlingTimer = setTimeout(() => {
      settlingTimer = null;
      setPhase('normal');
    }, TTS_PRESENTATION_PHASE_DURATIONS.settling);
  }, TTS_PRESENTATION_PHASE_DURATIONS.interruption);
}

export function resetTtsPresentationSignal(): void {
  clearTimers();
  setPhase('normal');
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function useTtsPresentationSignal(): TtsPresentationPhase {
  return useSyncExternalStore(subscribe, getTtsPresentationPhase, getTtsPresentationPhase);
}
