import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Whether the system has reduce-motion enabled. Read once; static for the
// lifetime of the surface. Motion is a favor here, never a requirement.
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduced(enabled);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return reduced;
}