import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gkhbncsjgjtcncuybeea.supabase.co';
const supabaseKey = 'sb_publishable_mFTWLrmevYdc0JchjeAC5w_1_jIFixa';

export const supabase = createClient(supabaseUrl, supabaseKey);
