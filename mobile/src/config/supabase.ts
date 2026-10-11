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

export const isSupabaseConfigured = () => !SUPABASE_URL.includes('YOUR-PROJECT-REF');
