/**
 * The only place the therapist (doctor) password is defined.
 *
 * It guards two actions: adding/changing the patient's doctor, and adding/deleting
 * documents on the Reports page. Replace this constant when the password changes.
 *
 * Note: anything in this file ships inside the APK, so this is a deterrent, not real
 * protection. Move the check to the backend once therapist accounts exist.
 */
export const THERAPIST_PASSWORD = 'thisissecretpassword';
