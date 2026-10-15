const mockListen = jest.fn();
const mockStopListening = jest.fn();

jest.mock('../specs/NativeCoach', () => ({
  __esModule: true,
  default: {
    listen: (...args: unknown[]) => mockListen(...args),
    stopListening: () => mockStopListening(),
    stopSpeaking: jest.fn(),
    speak: jest.fn(() => Promise.resolve()),
    playSound: jest.fn(() => Promise.resolve()),
    isRecognitionAvailable: jest.fn(() => Promise.resolve(true)),
    setKeepScreenOn: jest.fn(),
  },
}));

import {
  countdown,
  GO_WORDS,
  Interrupted,
  LISTEN_WINDOW_MS,
  MAX_LISTEN_WINDOWS,
  waitForGo,
} from '../src/services/coach';

const never = new Promise<void>(() => {});
const handlers = () => ({
  onVoiceUnavailable: jest.fn(),
  onNoSpeech: jest.fn(() => Promise.resolve()),
});

beforeEach(() => {
  mockListen.mockReset();
  mockStopListening.mockReset();
});

describe('waitForGo', () => {
  it('listens for one 30-second window and starts when "Go" is heard', async () => {
    mockListen.mockResolvedValueOnce('matched');
    const h = handlers();
    const result = await waitForGo(new AbortController().signal, never, true, h);
    expect(result).toBe('voice');
    expect(mockListen).toHaveBeenCalledTimes(1);
    expect(mockListen).toHaveBeenCalledWith(GO_WORDS, LISTEN_WINDOW_MS);
    expect(LISTEN_WINDOW_MS).toBe(30000);
    expect(h.onNoSpeech).not.toHaveBeenCalled();
  });

  it('after 30 seconds without speech, announces it, then waits for a tap', async () => {
    mockListen.mockResolvedValue('timeout');
    let tap!: () => void;
    const tapped = new Promise<void>(resolve => {
      tap = () => resolve();
    });
    const h = handlers();
    const waiting = waitForGo(new AbortController().signal, tapped, true, h);
    await new Promise<void>(r => setTimeout(r, 0));
    expect(mockListen).toHaveBeenCalledTimes(MAX_LISTEN_WINDOWS);
    expect(MAX_LISTEN_WINDOWS).toBe(1);
    expect(h.onNoSpeech).toHaveBeenCalledTimes(1);
    tap();
    await expect(waiting).resolves.toBe('no-speech');
    expect(mockListen).toHaveBeenCalledTimes(1); // no second window
  });

  it('treats recogniser errors (e.g. app in background) like no speech', async () => {
    mockListen.mockResolvedValue('error');
    const h = handlers();
    const waiting = waitForGo(new AbortController().signal, Promise.resolve(), true, h);
    await expect(waiting).resolves.toBe('no-speech');
    expect(mockListen).toHaveBeenCalledTimes(1);
    expect(h.onNoSpeech).toHaveBeenCalledTimes(1);
    expect(h.onVoiceUnavailable).not.toHaveBeenCalled();
  });

  it('accepts a tap instead of the voice command', async () => {
    mockListen.mockReturnValue(new Promise(() => {}));
    const result = await waitForGo(
      new AbortController().signal,
      Promise.resolve(),
      true,
      handlers(),
    );
    expect(result).toBe('tap');
    expect(mockStopListening).toHaveBeenCalled();
  });

  it('falls back to tapping when the microphone permission is refused', async () => {
    mockListen.mockResolvedValue('permission');
    let tap!: () => void;
    const tapped = new Promise<void>(resolve => {
      tap = () => resolve();
    });
    const h = handlers();
    const waiting = waitForGo(new AbortController().signal, tapped, true, h);
    await new Promise<void>(r => setTimeout(r, 0));
    expect(h.onVoiceUnavailable).toHaveBeenCalled();
    tap();
    await expect(waiting).resolves.toBe('voice-unavailable');
  });

  it('stops listening when the exercise is skipped or ended', async () => {
    mockListen.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const waiting = waitForGo(controller.signal, never, true, handlers());
    controller.abort();
    await expect(waiting).rejects.toBeInstanceOf(Interrupted);
    expect(mockStopListening).toHaveBeenCalled();
  });
});

describe('countdown (used for holds and rests)', () => {
  it('counts down to 0 and can be cut short', async () => {
    jest.useFakeTimers();
    const ticks: number[] = [];
    const done = countdown(5, new AbortController().signal, left => ticks.push(left));
    jest.advanceTimersByTime(5100);
    await done;
    expect(ticks[0]).toBe(5);
    expect(ticks[ticks.length - 1]).toBe(0);

    const controller = new AbortController();
    const rest = countdown(30, controller.signal, () => {});
    controller.abort();
    await expect(rest).rejects.toBeInstanceOf(Interrupted);
    jest.useRealTimers();
  });
});
