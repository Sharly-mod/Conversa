import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// C'est cet objet 'supabase' qu'on utilisera partout
export const supabase = createClient(supabaseUrl, supabaseAnonKey);