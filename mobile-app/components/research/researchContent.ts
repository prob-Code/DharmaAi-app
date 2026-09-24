import type { AnswerOption } from './AnswerControls';

// Central presentational copy and configurable content for the participant
// research surfaces. None of this is protocol or scoring logic — instrument
// items and wording are presentation defaults that the research team owns and
// overrides per the approved protocol.

export const researchCopy = {
  consent: {
    eyebrow: 'Before we begin',
    title: 'A quiet word',
    summary:
      'This space is part of a wellbeing research programme. Nothing here is a diagnosis, a treatment, or a cure — it is simply a place to talk, reflect, and continue where you left off.',
    points: [
      'Participation is always voluntary.',
      'You may pause or stop at any time, for any reason.',
      'Only the people running this study can see your responses.',
      'You can return any time — nothing disappears.',
    ],
    acknowledge: 'I understand, and I agree to take part',
    continue: 'Continue gently',
    decline: 'Not now',
  },
  adss: {
    eyebrow: 'A short check-in',
    title: 'How have things felt?',
    subtitle:
      'Take your time. There are no right answers — only what is true for you right now.',
    progressLabel: (current: number, total: number) => `${current} of ${total}`,
    submitLabel: 'Continue',
    // Configurable default items. Replace with the approved instrument items.
    items: [
      'In recent weeks, have you felt more tired than usual?',
      'Has it been hard to switch your mind off?',
      'Have things that used to help felt harder to reach for?',
      'Have you felt alone even in company?',
      'Have small pressures felt heavier than usual?',
    ],
    scale: [
      { value: 'rarely', label: 'Rarely' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often', label: 'Often' },
      { value: 'mostly', label: 'Mostly' },
      { value: 'always', label: 'Always' },
    ] as ReadonlyArray<AnswerOption>,
  },
  assessment: {
    eyebrow: 'A gentle baseline',
    title: 'How are you, truly?',
    subtitle:
      'A few quiet questions before your sessions begin. There are no right answers.',
    progressLabel: (current: number, total: number) => `${current} of ${total}`,
    submitLabel: 'Continue',
    // Configurable default items. Replace with the approved instrument items.
    items: [
      'In the last two weeks, how often have you felt at ease?',
      'How often has worry followed you through the day?',
      'How often have you been able to rest properly?',
      'How often have you felt connected to the people around you?',
      'How often have you felt a sense of meaning in your days?',
    ],
    scale: [
      { value: 'rarely', label: 'Rarely' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often', label: 'Often' },
      { value: 'mostly', label: 'Mostly' },
      { value: 'always', label: 'Always' },
    ] as ReadonlyArray<AnswerOption>,
  },
  domainConfirmation: {
    eyebrow: 'What feels most relevant right now?',
    title: 'What you chose',
    note: 'We will focus our time together on what matters most to you. This is not a label and not a diagnosis — it is simply the thread we will follow.',
    confirmLabel: 'This feels right',
    reconsiderLabel: 'Show me something else',
  },
  sessions: {
    eyebrow: 'Our time together',
    // Continuity shown in words, never raw state.
    markers: ['One', 'Two', 'Three'],
    themes: [
      {
        marker: 'One',
        heading: 'To open what you carry',
        body: 'We begin by understanding what is here, without hurry.',
      },
      {
        marker: 'Two',
        heading: 'To stay a while, and explore',
        body: 'We return to what lingers, and sit with it a little longer.',
      },
      {
        marker: 'Three',
        heading: 'To bring it together',
        body: 'We gather the thread gently, and let it settle.',
      },
    ],
    beginLabel: 'Begin quietly',
  },
  feedback: {
    eyebrow: 'A moment for you',
    title: 'How did this feel?',
    subtitle:
      'A few short questions so the space can better serve people like you.',
    categories: [
      { id: 'usefulness', label: 'How useful was this for you?' },
      { id: 'relevance', label: 'How relevant did it feel to your life?' },
      { id: 'heard', label: 'Did you feel heard?' },
      { id: 'appropriateness', label: 'Was the pacing comfortable?' },
    ],
    scale: [
      { value: 'not_at_all', label: 'Not at all' },
      { value: 'a_little', label: 'A little' },
      { value: 'somewhat', label: 'Somewhat' },
      { value: 'mostly', label: 'Mostly' },
      { value: 'very', label: 'Very much' },
    ] as ReadonlyArray<AnswerOption>,
    commentLabel: 'Anything you would like us to know?',
    commentPlaceholder: 'Only if you wish…',
    commentOptional: 'Optional',
    submitLabel: 'Share',
  },
  completion: {
    eyebrow: 'This part of the journey closes here',
    title: 'Thank you.',
    body:
      'What you shared matters, and it stays with us only as part of this study. The Companion remains — you can always return, continue the conversation, and pick up wherever you left off.',
    continueLabel: 'Return to the Companion',
  },
} as const;