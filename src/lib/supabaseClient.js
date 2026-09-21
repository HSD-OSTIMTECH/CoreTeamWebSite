import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Frontend Client — SADECE OKUMA (SELECT) ve Realtime İçin
 * Bu client publishable anon key kullanır. Tüm yazma işlemleri (INSERT/UPDATE/DELETE)
 * backend API üzerinden yapılmalıdır (/api/tasks, /api/auth endpoints).
 * Supabase RLS politikaları anon key ile yazma işlemlerini engellemektedir.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
