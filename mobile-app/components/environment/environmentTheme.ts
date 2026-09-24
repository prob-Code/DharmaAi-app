// ANANTA Companion environment — FROZEN visual tokens.
//
// Ground: deep charcoal-black, cool undertone, never pure black, never navy,
// never saturated blue.
// Middle: substantially desaturated cool blue-grey diagonal wave bands;
// muted teal appears only at the wave edges.
// Near: extremely faint warm brown-grey within the lower safe-area region.

export const ENV_COLORS = {
  ground: '#0A0E12',
  groundDeep: '#07090C',
  // substantially desaturated cool blue-grey wave bodies
  bandCoolTop: 'rgba(148, 163, 173, 0.055)',
  bandCoolBottom: 'rgba(138, 154, 166, 0.045)',
  // muted teal only at the wave seams
  bandEdge: 'rgba(113, 149, 143, 0.14)',
  // extremely faint warm brown-grey
  nearWarm: 'rgba(138, 124, 107, 0.07)',
  nearWarmListening: 'rgba(138, 124, 107, 0.11)',
} as const;

export const ENV_MOTION = {
  bandAnglePortrait: 14,
  bandAngleWide: 10,
  driftIdleMs: 30000,
  driftListeningMs: 46000,
  // bands pull toward the lower interaction region while listening
  listenShift: 26,
  speakingPulseMs: 3000,
  // matches the PRIMARY TTS presentation signal window (400 interruption + 500 settling)
  interruptionSettleMs: 900,
  nearIdle: 0.07,
  nearListening: 0.11,
  nearSpeaking: 0.09,
} as const;

// Overscan so the rotated wave stage never exposes a field edge.
export const ENV_GEOMETRY = {
  overscan: 0.6,
  bandCount: 4,
} as const;