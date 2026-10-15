/**
 * Supabase project settings. Fill these in from the Supabase dashboard
 * (Project Settings → API). The publishable/anon key is safe to ship in the app:
 * row level security decides what each signed-in user can see.
 */
export const SUPABASE_URL = 'https://cpgmfjdiywtmvgmvtyoo.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OmJh6yCzfazD1kSwnszXiw_ToJ5aDrF';

/**
 * E-mail of the shared clinic login (created in Supabase → Authentication → Users).
 * Therapists type only the password when the app asks for it; it is never stored.
 */
export const CLINIC_LOGIN_EMAIL = 'whatcool4@gmail.com';

/**
 * Google sign-in: the *Web application* OAuth client ID from Google Cloud Console
 * (APIs & Services → Credentials). The same ID goes into Supabase → Authentication →
 * Sign In / Providers → Google. It is not a secret. See SUPABASE_SETUP.md, "Google sign-in".
 */
export const GOOGLE_WEB_CLIENT_ID = '466598001979-ctuc6h02fd2o3bav4lncmfu5jq305498.apps.googleusercontent.com';

export const isGoogleConfigured = () => !GOOGLE_WEB_CLIENT_ID.startsWith('YOUR-');

export const isSupabaseConfigured = () => !SUPABASE_URL.includes('YOUR-PROJECT-REF');
