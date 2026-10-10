/** Strips non-digits and limits length; used for mobile number and PIN inputs. */
export function digitsOnly(text: string, maxLength: number) {
  return text.replace(/\D/g, '').slice(0, maxLength);
}

export function isValidMobile(mobile: string) {
  return /^[6-9]\d{9}$/.test(mobile);
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? '';
}
