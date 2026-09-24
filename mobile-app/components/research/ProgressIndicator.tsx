import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { researchPalette } from './researchTheme';

interface Props {
  current: number;
  total: number;
  label?: string;
  testID?: string;
}

// Restrained progress: a thin track and a quiet caption. No large bars,
// no percentages, no garish fills.
export const ProgressIndicator: React.FC<Props> = ({
  current,
  total,
  label,
  testID,
}) => {
  const clamped = Math.max(0, Math.min(current, total));
  const progress = total <= 0 ? 1 : clamped / total;

  return (
    <View
      style={styles.container}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: clamped }}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      {label ? <Text style={styles.caption}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: researchPalette.border,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: researchPalette.accent,
  },
  caption: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: researchPalette.muted,
  },
});