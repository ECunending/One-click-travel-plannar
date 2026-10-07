import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fail closed: a missing connection never reports a local save as a cloud save.
export const database = url && key ? createClient(url, key) : null;
