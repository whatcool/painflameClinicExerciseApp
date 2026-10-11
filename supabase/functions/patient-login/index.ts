// Patient sign-in with mobile number + 6-digit PIN.
// Locks the account for 15 minutes after 5 wrong PINs.
import {
  adminClient,
  corsHeaders,
  fail,
  isValidMobile,
  isValidPin,
  json,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  passwordFor,
  patientEmail,
  publicClient,
  readJson,
} from '../_shared/common.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const { mobile, pin } = await readJson(req);
  if (!isValidMobile(mobile) || !isValidPin(pin)) {
    return fail(400, 'invalid_input');
  }

  const admin = adminClient();
  const { data: patient } = await admin
    .from('patients')
    .select('id, activated_at')
    .eq('mobile', mobile)
    .maybeSingle();
  if (!patient) {
    return fail(401, 'invalid_credentials');
  }
  if (!patient.activated_at) {
    return fail(403, 'not_activated');
  }

  const { data: secret } = await admin
    .from('patient_secrets')
    .select('failed_logins, locked_until')
    .eq('patient_id', patient.id)
    .single();
  const lockedUntil = secret?.locked_until ? new Date(secret.locked_until) : null;
  if (lockedUntil && lockedUntil > new Date()) {
    return fail(429, 'locked', {
      retry_after_minutes: Math.ceil((lockedUntil.getTime() - Date.now()) / 60000),
    });
  }

  const { data, error } = await publicClient().auth.signInWithPassword({
    email: patientEmail(mobile),
    password: await passwordFor(mobile, pin),
  });

  if (error || !data.session) {
    const failed = (secret?.failed_logins ?? 0) + 1;
    if (failed >= MAX_FAILED_LOGINS) {
      await admin
        .from('patient_secrets')
        .update({
          failed_logins: 0,
          locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
        })
        .eq('patient_id', patient.id);
      return fail(429, 'locked', { retry_after_minutes: LOCK_MINUTES });
    }
    await admin
      .from('patient_secrets')
      .update({ failed_logins: failed })
      .eq('patient_id', patient.id);
    return fail(401, 'invalid_credentials', { attempts_left: MAX_FAILED_LOGINS - failed });
  }

  await admin
    .from('patient_secrets')
    .update({ failed_logins: 0, locked_until: null })
    .eq('patient_id', patient.id);

  return json({
    patient_id: patient.id,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
