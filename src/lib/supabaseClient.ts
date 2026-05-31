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
    throw new Error(sessionError.message);
  }

  if (session) {
    if (!session.user?.id) {
      throw new Error('No user in existing session');
    }
    return { userId: session.user.id };
  }

  const { data: anonData, error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    throw new Error(signInError.message);
  }
  if (!anonData?.user?.id) {
    throw new Error('No user returned from anonymous sign-in');
  }

  return { userId: anonData.user.id };
}
