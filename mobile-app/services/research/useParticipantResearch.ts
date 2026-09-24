import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ParticipantResearchController,
  type ResearchSnapshot,
} from './researchController';

export type ResearchHydrationStatus = 'idle' | 'hydrating' | 'ready' | 'unavailable';

export interface ParticipantResearchHandle {
  status: ResearchHydrationStatus;
  snapshot: ResearchSnapshot | null;
  controller: ParticipantResearchController | null;
  error: unknown;
  retry: () => void;
}

export function useParticipantResearch(userId: string | null): ParticipantResearchHandle {
  const [status, setStatus] = useState<ResearchHydrationStatus>('idle');
  const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<ParticipantResearchController | null>(null);

  useEffect(() => {
    let disposed = false;

    const reset = () => {
      controllerRef.current = null;
      setSnapshot(null);
      setError(null);
    };

    if (userId === null) {
      reset();
      setStatus('idle');
      return;
    }

    reset();
    setStatus('hydrating');

    const boot = async () => {
      try {
        const controller = await ParticipantResearchController.create(userId, {
          onStateChange: (next) => {
            if (!disposed) {
              setSnapshot(next);
            }
          },
        });

        if (disposed) {
          return;
        }

        controllerRef.current = controller;
        const hydrated = await controller.hydrate();

        if (!disposed) {
          controllerRef.current = controller;
          setSnapshot(hydrated);
          setStatus('ready');
        }
      } catch (cause) {
        controllerRef.current = null;
        if (!disposed) {
          setError(cause);
          setStatus('unavailable');
        }
      }
    };

    void boot();

    return () => {
      disposed = true;
      controllerRef.current = null;
    };
  }, [userId, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return {
    status,
    snapshot,
    controller: controllerRef.current,
    error,
    retry,
  };
}