import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

// Stored per user so it can be raised later without breaking existing accounts.
export const PIN_ITERATIONS = 20000;

export const PIN_LENGTH = 6;

export function isValidPin(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export async function hashPin(pin: string, iterations = PIN_ITERATIONS) {
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 });
  return { salt: bytesToHex(salt), hash: bytesToHex(hash), iterations };
}

export async function verifyPin(
  pin: string,
  stored: { salt: string; hash: string; iterations: number },
) {
  const hash = await pbkdf2Async(sha256, utf8ToBytes(pin), hexToBytes(stored.salt), {
    c: stored.iterations,
    dkLen: 32,
  });
  const expected = hexToBytes(stored.hash);
  // Constant-time comparison
  /* eslint-disable no-bitwise */
  let diff = hash.length ^ expected.length;
  for (let i = 0; i < Math.min(hash.length, expected.length); i++) {
    diff |= hash[i] ^ expected[i];
  }
  /* eslint-enable no-bitwise */
  return diff === 0;
}
