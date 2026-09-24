import {
  TTS_PRESENTATION_PHASE_DURATIONS,
  getTtsPresentationPhase,
  resetTtsPresentationSignal,
  signalTtsInterruption,
} from './ttsPresentationSignal';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runTtsPresentationSignalTests(): Promise<void> {
  const { interruption, settling } = TTS_PRESENTATION_PHASE_DURATIONS;

  resetTtsPresentationSignal();
  assert(getTtsPresentationPhase() === 'normal', 'signal should start settled at normal');

  signalTtsInterruption();
  assert(getTtsPresentationPhase() === 'interruption', 'signal should enter interruption synchronously');

  await sleep(interruption + 50);
  assert(getTtsPresentationPhase() === 'settling', 'signal should enter settling after the interruption window');

  await sleep(settling + 50);
  assert(getTtsPresentationPhase() === 'normal', 'signal should return to normal after the settling window');

  signalTtsInterruption();
  await sleep(interruption - 100);
  assert(getTtsPresentationPhase() === 'interruption', 'signal should still be interrupting before the window ends');
  signalTtsInterruption();
  await sleep(150);
  assert(getTtsPresentationPhase() === 'interruption', 'a re-signal should restart the interruption window');
  await sleep(interruption);
  assert(getTtsPresentationPhase() === 'settling', 'a retriggered signal should still settle on schedule');

  signalTtsInterruption();
  resetTtsPresentationSignal();
  assert(getTtsPresentationPhase() === 'normal', 'reset should return to normal immediately');
  await sleep(interruption + settling + 100);
  assert(getTtsPresentationPhase() === 'normal', 'reset should cancel every pending settle timer');
}

runTtsPresentationSignalTests()
  .then(() => console.log('ttsPresentationSignal tests passed'))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
