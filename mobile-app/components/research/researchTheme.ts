import { Platform } from 'react-native';

// Research surface palette — "deep water at night".
// Charcoal-black with a cool blue-grey undertone, never pure black,
// never saturated navy. Restrained muted teal is used sparingly at the
// edges; a faint warm brown-grey is sensed rather than announced.
export const researchPalette = {
  // Ground
  ground: '#0B0E12',
  surface: '#12171C',
  surfaceRaised: '#1A2026',
  border: 'rgba(206, 221, 231, 0.10)',
  borderStrong: 'rgba(206, 221, 231, 0.18)',

  // Cool blue-grey text
  text: '#DDE4E8',
  muted: '#8B98A3',
  faint: '#77828C',

  // Restrained muted teal (edges)
  accent: '#71958F',
  accentText: '#0D1215',
  accentSoft: 'rgba(113, 149, 143, 0.16)',

  // Faint warm brown-grey
  warm: '#8A7C6B',
  warmSoft: 'rgba(138, 124, 107, 0.13)',

  danger: '#C98A8A',
  success: '#7FA892',
} as const;

export type ResearchPalette = typeof researchPalette;

// Serif display face used by the app for titles.
export const displayFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

// Layout constants tuned for a ~390 × 844 portrait target while staying
// flexible through proportional spacing.
export const researchLayout = {
  pagePadding: 24,
  screenMaxWidth: 520,
  touchTargetMin: 44,
} as const;