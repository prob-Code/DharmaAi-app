import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveEnvironmentPhase, type EnvironmentInputs } from './environmentPhase';
import { ENV_COLORS, ENV_GEOMETRY, ENV_MOTION } from './environmentTheme';

// ANANTA Companion environment — READ-ONLY PRESENTATIONAL LEAF.
//
// It is one continuous inhabited-darkness surface, never six screens. It
// consumes existing Companion visual inputs and derives its six phases
// presentationally (resolveEnvironmentPhase). It never starts/stops TTS,
// never controls recording, never mutates research/session/controller state,
// and never becomes a state owner. The only timers it manages are its own
// animation loops and a transient interruption-visible window.

export interface EnvironmentLayerProps {
  /** Voice is capturing (existing `RECORDING` state). */
  listening?: boolean;
  /** Text/voice work in progress (existing `PROCESSING` / `isLoading`). */
  processing?: boolean;
  /** TTS speaking (existing `isVoiceSpeaking`). */
  speaking?: boolean;
  /** PRIMARY presentation-only interruption signal. */
  interrupted?: boolean;
  /** Conversation rows present (existing message lifecycle). */
  hasConversation?: boolean;
  /** Force reduced motion; otherwise read from AccessibilityInfo. */
  reduceMotionOverride?: boolean;
  testID?: string;
}

export const EnvironmentLayer: React.FC<EnvironmentLayerProps> = ({
  listening = false,
  processing = false,
  speaking = false,
  interrupted = false,
  hasConversation = false,
  reduceMotionOverride,
  testID,
}) => {
  const { width, height } = useWindowDimensions();

  // Motion prefs (read once; external reduceMotionOverride wins).
  const [reduceMotion, setReduceMotion] = useState(reduceMotionOverride ?? false);
  useEffect(() => {
    if (reduceMotionOverride !== undefined) {
      setReduceMotion(reduceMotionOverride);
      return;
    }
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      mounted = false;
    };
  }, [reduceMotionOverride]);

  // Animation values — the only "state" here, and it is purely visual.
  const drift = useRef(new Animated.Value(0)).current; // 0..1 slow band travel
  const zoneShift = useRef(new Animated.Value(0)).current; // pull toward near zone
  const breath = useRef(new Animated.Value(0)).current; // speaking outward pulse
  const nearOpacity = useRef(new Animated.Value(ENV_MOTION.nearIdle)).current;

  const driftLoop = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Transient interruption window so the 800ms settle renders even when the
  // PRIMARY signal is a momentary bool. Timer owned here only (presentation).
  const [interruptionVisible, setInterruptionVisible] = useState(false);
  useEffect(() => {
    if (!interrupted) {
      return;
    }
    setInterruptionVisible(true);
    const timer = setTimeout(
      () => setInterruptionVisible(false),
      ENV_MOTION.interruptionSettleMs,
    );
    return () => clearTimeout(timer);
  }, [interrupted]);

  const inputs: EnvironmentInputs = { listening, processing, speaking, hasConversation, interrupted: false };
  const steadyPhase = resolveEnvironmentPhase(inputs);
  const phase = interruptionVisible && !reduceMotion ? 'interruption' : steadyPhase;

  const stopAll = () => {
    driftLoop.current?.stop();
    driftLoop.current = null;
    pulseLoop.current?.stop();
    pulseLoop.current = null;
  };

  // Interruption: release the speaking pulse and ease toward the listening
  // configuration over ~800ms. No error treatment.
  const runInterruption = () => {
    stopAll();
    Animated.timing(breath, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    Animated.timing(zoneShift, {
      toValue: ENV_MOTION.listenShift,
      duration: ENV_MOTION.interruptionSettleMs,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      useNativeDriver: true,
    }).start();
    Animated.timing(nearOpacity, {
      toValue: ENV_MOTION.nearListening,
      duration: ENV_MOTION.interruptionSettleMs,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      useNativeDriver: true,
    }).start();
  };

  const startDrift = (durationMs: number) => {
    driftLoop.current?.stop();
    driftLoop.current = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: durationMs,
        easing: (t: number) => t,
        useNativeDriver: true,
      }),
    );
    driftLoop.current.start();
  };

  const startPulse = () => {
    pulseLoop.current?.stop();
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: ENV_MOTION.speakingPulseMs * 0.7,
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: ENV_MOTION.speakingPulseMs * 0.3,
          easing: (t: number) => t * t,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.current.start();
  };

  const settle = (toNear: number, toZone: number) => {
    Animated.timing(nearOpacity, {
      toValue: toNear,
      duration: 900,
      useNativeDriver: true,
    }).start();
    Animated.timing(zoneShift, {
      toValue: toZone,
      duration: 900,
      useNativeDriver: true,
    }).start();
  };

  // Phase → behavior. PROCESSING freezes the listening configuration.
  useEffect(() => {
    if (reduceMotion) {
      stopAll();
      Animated.timing(nearOpacity, {
        toValue: listening ? ENV_MOTION.nearListening : ENV_MOTION.nearIdle,
        duration: 400,
        useNativeDriver: true,
      }).start();
      Animated.timing(zoneShift, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      Animated.timing(breath, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      return;
    }

    switch (phase) {
      case 'interruption':
        runInterruption();
        return;
      case 'speaking':
        startDrift(ENV_MOTION.driftIdleMs);
        startPulse();
        settle(ENV_MOTION.nearSpeaking, 0);
        return;
      case 'processing':
        stopAll();
        return; // total stillness; keep the listening configuration
      case 'listening':
        startDrift(ENV_MOTION.driftListeningMs);
        settle(ENV_MOTION.nearListening, ENV_MOTION.listenShift);
        return;
      default: // idle + text: the same ambient world, slow drift
        startDrift(ENV_MOTION.driftIdleMs);
        settle(ENV_MOTION.nearIdle, 0);
        return;
    }
  }, [phase, reduceMotion, listening]);

  // Clean up all animation loops/timers on unmount.
  useEffect(() => {
    return () => {
      driftLoop.current?.stop();
      pulseLoop.current?.stop();
      drift.stopAnimation();
      breath.stopAnimation();
      zoneShift.stopAnimation();
      nearOpacity.stopAnimation();
    };
  }, []);

  const driftTranslate = useMemo(
    () =>
      drift.interpolate({
        inputRange: [0, 1],
        outputRange: [-46, 86],
      }),
    [drift],
  );
  const breathScale = useMemo(
    () =>
      breath.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.018],
      }),
    [breath],
  );
  const breathLift = useMemo(
    () =>
      breath.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -12],
      }),
    [breath],
  );

  const wide = width > height;
  const angle = wide ? ENV_MOTION.bandAngleWide : ENV_MOTION.bandAnglePortrait;
  const overscan = Math.max(width, height) * ENV_GEOMETRY.overscan;

  const bands = useMemo(
    () =>
      Array.from({ length: ENV_GEOMETRY.bandCount }, (_, index) => {
        const topFraction = [0.08, 0.3, 0.54, 0.76][index] ?? 0.1 + index * 0.2;
        const bandHeight = [150, 200, 150, 200][index] ?? 150;
        return { topFraction, bandHeight, key: `band-${index}` };
      }),
    [],
  );

  const translateY = Animated.add(driftTranslate, zoneShift);

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Ground — deep charcoal, cool undertone, full field */}
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={[ENV_COLORS.ground, ENV_COLORS.groundDeep]}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 1 }}
      />

      {/* Middle — diagonal wave bands, substantially desaturated, teal at seams */}
      <View
        style={[
          styles.midStage,
          {
            position: 'absolute',
            left: -overscan,
            right: -overscan,
            top: -overscan,
            bottom: -overscan,
            transform: [{ rotate: `${angle}deg` }],
          },
        ]}
      >
        <Animated.View
          style={{
            flex: 1,
            transform: [
              { translateY },
              { translateY: breathLift },
              { scaleY: breathScale },
            ],
          }}
        >
          {bands.map((band) => (
            <LinearGradient
              key={band.key}
              style={{
                position: 'absolute',
                top: `${band.topFraction * 100}%`,
                height: band.bandHeight,
                width: '100%',
              }}
              colors={[
                'rgba(113, 149, 143, 0)',
                ENV_COLORS.bandCoolTop,
                ENV_COLORS.bandEdge,
                ENV_COLORS.bandCoolBottom,
                'rgba(113, 149, 143, 0)',
              ]}
              locations={[0, 0.4, 0.5, 0.6, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              pointerEvents="none"
            />
          ))}
        </Animated.View>
      </View>

      {/* Near — extremely faint warm brown-grey in the lower region */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.nearWrap, { opacity: nearOpacity }]}
      >
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={['rgba(138, 124, 107, 0)', 'rgba(138, 124, 107, 1)']}
            locations={[0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  midStage: {
    alignItems: 'stretch',
  },
  nearWrap: {
    overflow: 'hidden',
  },
});