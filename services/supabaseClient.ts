
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config';

// Supabase is mandatory. No offline fallback allowed.
const isConfigValid = CONFIG.SUPABASE.URL && 
                     CONFIG.SUPABASE.URL !== 'YOUR_SUPABASE_URL' && 
                     CONFIG.SUPABASE.ANON_KEY && 
                     CONFIG.SUPABASE.ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

if (!isConfigValid) {
    console.error("Supabase configuration is missing or invalid. App will not function.");
}

const SUPABASE_URL = isConfigValid ? CONFIG.SUPABASE.URL : 'https://missing-config.supabase.co';
const SUPABASE_ANON_KEY = isConfigValid ? CONFIG.SUPABASE.ANON_KEY : 'missing-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isSupabaseConfigured = () => {
    return isConfigValid;
};
