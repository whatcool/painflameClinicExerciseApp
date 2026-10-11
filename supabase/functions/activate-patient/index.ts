// First-time activation, and PIN reset: the patient enters the one-time code from the
// clinic and chooses a 6-digit PIN. Also records DPDP consent.
import {
  adminClient,
  corsHeaders,
  fail,
  hashSetupCode,
  isValidMobile,
  isValidPin,
  json,
  MAX_SETUP_ATTEMPTS,
  passwordFor,
  readJson,
  safeEqual,
} from '../_shared/common.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const { mobile, code, pin, consent } = await readJson(req);
  if (!isValidMobile(mobile) || typeof code !== 'string' || !/^\d{8}$/.test(code) || !isValidPin(pin)) {
    return fail(400, 'invalid_input');
  }
  if (consent !== true) {
    return fail(400, 'consent_required');
  }

  const admin = adminClient();
  const { data: patient } = await admin
    .from('patients')
    .select('id')
    .eq('mobile', mobile)
    .maybeSingle();
  if (!patient) {
    return fail(400, 'invalid_code');
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

  const { error: authError } = await admin.auth.admin.updateUserById(patient.id, {
    password: await passwordFor(mobile, pin),
  });
  if (authError) {
    return fail(500, 'server_error');
  }

  const now = new Date().toISOString();
  await admin
    .from('patient_secrets')
    .update({
      setup_code_hash: null,
      setup_code_expires_at: null,
      setup_attempts: 0,
      failed_logins: 0,
      locked_until: null,
    })
    .eq('patient_id', patient.id);
  await admin.from('patients').update({ activated_at: now, consent_at: now }).eq('id', patient.id);

  return json({ ok: true });
});
