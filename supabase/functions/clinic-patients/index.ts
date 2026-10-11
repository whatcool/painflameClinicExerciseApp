// Clinic-only patient management, called from the admin panel (and nothing else):
//   { action: 'create', mobile, full_name, gender, dob, doctor_id? } -> { patient_id, setup_code, expires_at }
//   { action: 'new-code', patient_id }                                 -> { setup_code, expires_at }
//   { action: 'delete', patient_id }                                   -> { ok }
import {
  adminClient,
  corsHeaders,
  fail,
  hashSetupCode,
  isValidMobile,
  json,
  newSetupCode,
  patientEmail,
  randomPassword,
  readJson,
  SETUP_CODE_DAYS,
} from '../_shared/common.ts';

const GENDERS = ['Male', 'Female', 'Other'];

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const admin = adminClient();

  // Only the shared clinic login may call this.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: caller } = await admin.auth.getUser(token);
  if (caller.user?.app_metadata?.role !== 'clinic') {
    return fail(403, 'clinic_only');
  }

  const body = await readJson(req);

  const issueCode = async (patientId: string) => {
    const code = newSetupCode();
    const expiresAt = new Date(Date.now() + SETUP_CODE_DAYS * 86400000).toISOString();
    const { error } = await admin.from('patient_secrets').upsert({
      patient_id: patientId,
      setup_code_hash: await hashSetupCode(patientId, code),
      setup_code_expires_at: expiresAt,
      setup_attempts: 0,
      failed_logins: 0,
      locked_until: null,
    });
    if (error) {
      throw error;
    }
    return { setup_code: code, expires_at: expiresAt };
  };

  switch (body.action) {
    case 'create': {
      const { mobile, full_name, gender, dob, doctor_id } = body;
      if (
        !isValidMobile(mobile) ||
        typeof full_name !== 'string' ||
        !full_name.trim() ||
        typeof gender !== 'string' ||
        !GENDERS.includes(gender) ||
        typeof dob !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dob)
      ) {
        return fail(400, 'invalid_input');
      }
      const { data: existing } = await admin
        .from('patients')
        .select('id')
        .eq('mobile', mobile)
        .maybeSingle();
      if (existing) {
        return fail(409, 'mobile_exists');
      }
      const { data: created, error: authError } = await admin.auth.admin.createUser({
        email: patientEmail(mobile),
        password: randomPassword(), // replaced when the patient activates with their PIN
        email_confirm: true,
        app_metadata: { role: 'patient' },
      });
      if (authError || !created.user) {
        return fail(500, 'server_error', { message: authError?.message });
      }
      const patientId = created.user.id;
      const { error: insertError } = await admin.from('patients').insert({
        id: patientId,
        mobile,
        full_name: full_name.trim(),
        gender,
        dob,
        doctor_id: typeof doctor_id === 'string' && doctor_id ? doctor_id : null,
      });
      if (insertError) {
        await admin.auth.admin.deleteUser(patientId); // undo the half-created account
        return fail(500, 'server_error', { message: insertError.message });
      }
      return json({ patient_id: patientId, ...(await issueCode(patientId)) });
    }

    case 'new-code': {
      // Used when a patient forgets their PIN or gets a new phone.
      if (typeof body.patient_id !== 'string') {
        return fail(400, 'invalid_input');
      }
      return json(await issueCode(body.patient_id));
    }

    case 'delete': {
      if (typeof body.patient_id !== 'string') {
        return fail(400, 'invalid_input');
      }
      const patientId = body.patient_id;
      // Remove the patient's files, then the account (rows cascade).
      for (const folder of ['reports', 'profile']) {
        const { data: files } = await admin.storage
          .from('patient-files')
          .list(`${patientId}/${folder}`, { limit: 1000 });
        if (files?.length) {
          await admin.storage
            .from('patient-files')
            .remove(files.map(file => `${patientId}/${folder}/${file.name}`));
        }
      }
      const { error } = await admin.auth.admin.deleteUser(patientId);
      if (error) {
        return fail(500, 'server_error', { message: error.message });
      }
      return json({ ok: true });
    }

    default:
      return fail(400, 'unknown_action');
  }
});
