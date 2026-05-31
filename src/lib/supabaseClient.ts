import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export async function getAnonSession(): Promise<{ userId: string }> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error('Failed to get session');
  }

  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  const { data: anonData, error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    throw new Error('Failed to sign in anonymously');
  }
  if (!anonData?.user?.id) {
    throw new Error('Anonymous sign-in returned no user');
  }

  return { userId: anonData.user.id };
}
