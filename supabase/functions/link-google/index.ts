// Links the signed-in Google account to a patient record (app 1.2+).
// Called once, after the first Google sign-in: { mobile, code, consent: true }.
// The code is the one-time 8-digit code from the clinic (the same code used in app 1.1).
// Also used when a patient changes Google account: the clinic issues a new code.
import {
  adminClient,
  corsHeaders,
  fail,
  hashSetupCode,
  isValidMobile,
  json,
  MAX_SETUP_ATTEMPTS,
  readJson,
  safeEqual,
} from '../_shared/common.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const admin = adminClient();

  // Who is calling: must be signed in with Google.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: caller } = await admin.auth.getUser(token);
  const user = caller.user;
  const isGoogle =
    user?.app_metadata?.provider === 'google' ||
    (user?.identities ?? []).some(identity => identity.provider === 'google');
  if (!user || !isGoogle) {
    return fail(401, 'google_sign_in_required');
  }

  const { mobile, code, consent } = await readJson(req);
  if (!isValidMobile(mobile) || typeof code !== 'string' || !/^\d{8}$/.test(code)) {
    return fail(400, 'invalid_input');
  }
  if (consent !== true) {
    return fail(400, 'consent_required');
  }

  const { data: patient } = await admin
    .from('patients')
    .select('id, activated_at, google_user_id')
    .eq('mobile', mobile)
    .maybeSingle();
  if (!patient) {
    return fail(400, 'invalid_code');
  }

  // One Google account belongs to one patient.
  const { data: other } = await admin
    .from('patients')
    .select('id')
    .eq('google_user_id', user.id)
    .neq('id', patient.id)
    .maybeSingle();
  if (other) {
    return fail(409, 'google_already_linked');
  }

  const { data: secret } = await admin
    .from('patient_secrets')
    .select('setup_code_hash, setup_code_expires_at, setup_attempts')
    .eq('patient_id', patient.id)
    .single();
  if (!secret?.setup_code_hash) {
    return fail(400, 'invalid_code');
  }
  if (secret.setup_attempts >= MAX_SETUP_ATTEMPTS) {
    return fail(429, 'too_many_attempts');
  }
  if (secret.setup_code_expires_at && new Date(secret.setup_code_expires_at) < new Date()) {
    return fail(400, 'code_expired');
  }
  if (!safeEqual(await hashSetupCode(patient.id, code), secret.setup_code_hash)) {
    await admin
      .from('patient_secrets')
      .update({ setup_attempts: secret.setup_attempts + 1 })
      .eq('patient_id', patient.id);
    return fail(400, 'invalid_code', {
      attempts_left: MAX_SETUP_ATTEMPTS - secret.setup_attempts - 1,
    });
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('patients')
    .update({
      google_user_id: user.id,
      google_email: user.email ?? null,
      activated_at: patient.activated_at ?? now,
      consent_at: now,
    })
    .eq('id', patient.id);
  if (error) {
    return fail(500, 'server_error', { message: error.message });
  }
  await admin
    .from('patient_secrets')
    .update({ setup_code_hash: null, setup_code_expires_at: null, setup_attempts: 0 })
    .eq('patient_id', patient.id);

  return json({ patient_id: patient.id });
});
