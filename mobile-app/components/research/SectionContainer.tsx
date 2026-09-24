import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { researchLayout, researchPalette } from './researchTheme';

interface Props {
  children: React.ReactNode;
  /** Fixed action bar pinned below the content (buttons). */
  footer?: React.ReactNode;
  /** Optional header rendered above the scroll content. */
  header?: React.ReactNode;
  /** Set false to disable scrolling and center content vertically. */
  scroll?: boolean;
  /** Vertically center the content when not scrolling. */
  centered?: boolean;
  testID?: string;
  style?: ViewStyle;
}

// Shared research surface shell. Quiet ambient background with a faint
// diagonal material — deep charcoal with a cool blue-grey undertone and a
// restrained teal edge. Research machinery stays invisible.
export const SectionContainer: React.FC<Props> = ({
  children,
  footer,
  header,
  scroll = true,
  centered = false,
  testID,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const inner = (
    <View style={[styles.content, centered && styles.contentCentered]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, style]}
      testID={testID}
    >
      <LinearGradient
        colors={[researchPalette.ground, researchPalette.surface, researchPalette.ground]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Cool blue-grey upper material */}
      <LinearGradient
        colors={['rgba(134, 158, 170, 0.09)', 'rgba(134, 158, 170, 0)']}
        style={styles.upperWash}
        pointerEvents="none"
      />

      {/* Soft diagonal band — restrained teal edge */}
      <LinearGradient
        colors={[researchPalette.accentSoft, 'rgba(113, 149, 143, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.diagonalBand}
        pointerEvents="none"
      />

      {/* Faint warmth at the lower edge */}
      <LinearGradient
        colors={['rgba(138, 124, 107, 0)', 'rgba(138, 124, 107, 0.07)']}
        style={styles.warmFloor}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.fade, { opacity }]}>
          {scroll ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {inner}
            </ScrollView>
          ) : (
            <View style={styles.fixedContent}>{inner}</View>
          )}
        </Animated.View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: researchPalette.ground,
  },
  flex: {
    flex: 1,
  },
  upperWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  diagonalBand: {
    position: 'absolute',
    top: -80,
    right: -140,
    width: 460,
    height: 260,
    transform: [{ rotate: '16deg' }],
    opacity: 0.55,
  },
  warmFloor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  fade: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 32,
    paddingHorizontal: researchLayout.pagePadding,
    flexGrow: 1,
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: researchLayout.pagePadding,
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: researchLayout.screenMaxWidth,
    alignSelf: 'center',
    gap: 28,
  },
  contentCentered: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: researchLayout.pagePadding,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(206, 221, 231, 0.08)',
  },
});