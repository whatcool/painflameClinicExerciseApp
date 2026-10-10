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

import { GO_WORDS, Interrupted, LISTEN_WINDOW_MS, waitForGo } from '../src/services/coach';

const never = new Promise<void>(() => {});

beforeEach(() => {
  mockListen.mockReset();
  mockStopListening.mockReset();
});

describe('waitForGo', () => {
  it('keeps opening 10-second listening windows until "Go" is heard', async () => {
    mockListen
      .mockResolvedValueOnce('timeout')
      .mockResolvedValueOnce('timeout')
      .mockResolvedValueOnce('matched');
    const result = await waitForGo(new AbortController().signal, never, true, jest.fn());
    expect(result).toBe('voice');
    expect(mockListen).toHaveBeenCalledTimes(3);
    expect(mockListen).toHaveBeenCalledWith(GO_WORDS, LISTEN_WINDOW_MS);
    expect(LISTEN_WINDOW_MS).toBe(10000);
  });

  it('accepts a tap instead of the voice command', async () => {
    mockListen.mockReturnValue(new Promise(() => {}));
    const result = await waitForGo(new AbortController().signal, Promise.resolve(), true, jest.fn());
    expect(result).toBe('tap');
    expect(mockStopListening).toHaveBeenCalled();
  });

  it('falls back to tapping when the microphone cannot be used', async () => {
    mockListen.mockResolvedValue('permission');
    const unavailable = jest.fn();
    const result = await waitForGo(new AbortController().signal, Promise.resolve(), true, unavailable);
    expect(result).toBe('voice-unavailable');
    expect(unavailable).toHaveBeenCalled();
  });

  it('stops listening when the exercise is skipped or ended', async () => {
    mockListen.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const waiting = waitForGo(controller.signal, never, true, jest.fn());
    controller.abort();
    await expect(waiting).rejects.toBeInstanceOf(Interrupted);
    expect(mockStopListening).toHaveBeenCalled();
  });
});
