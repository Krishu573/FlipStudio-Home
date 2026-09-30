import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://vichklqnaaxjaiqlkwpp.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpY2hrbHFuYWF4amFpcWxrd3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Mzg5MTYsImV4cCI6MjEwNjAxNDkxNn0.wFvVHbA62jylhtG9K7YMOv9G9x9mefJkxaMpi5Uqph0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
