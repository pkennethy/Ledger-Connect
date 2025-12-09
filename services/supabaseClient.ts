import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config';

// FORCE DISABLE for development phase
const FORCE_DISABLE = true;

// Determine the URL and Key to use.
// We check if the user has updated the config.ts file from the placeholder defaults.
const isConfigValid = !FORCE_DISABLE && CONFIG.SUPABASE.URL !== 'YOUR_SUPABASE_URL' && CONFIG.SUPABASE.ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

const SUPABASE_URL = isConfigValid ? CONFIG.SUPABASE.URL : 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = isConfigValid ? CONFIG.SUPABASE.ANON_KEY : 'placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isSupabaseConfigured = () => {
    return isConfigValid;
};