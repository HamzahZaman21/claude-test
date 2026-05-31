import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session, AuthResponse } from '@supabase/supabase-js';

// We'll test the module by mocking @supabase/supabase-js and the env vars
// and then dynamically importing the module under test.

const mockGetSession = vi.fn();
const mockSignInAnonymously = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      signInAnonymously: mockSignInAnonymously,
    },
  })),
}));

// Set env vars before importing the module
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

describe('supabaseClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the Supabase client with correct URL and anon key', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    await import('./supabaseClient');
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    );
  });

  it('exports a supabase client instance', async () => {
    const mod = await import('./supabaseClient');
    expect(mod.supabase).toBeDefined();
    expect(typeof mod.supabase.auth.getSession).toBe('function');
  });

  it('exports getAnonSession as a function', async () => {
    const mod = await import('./supabaseClient');
    expect(typeof mod.getAnonSession).toBe('function');
  });
});

describe('getAnonSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the user id from an existing session without signing in', async () => {
    const fakeSession: Session = {
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      refresh_token: 'ref',
      user: { id: 'user-123', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' },
    };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession }, error: null });

    const { getAnonSession } = await import('./supabaseClient');
    const result = await getAnonSession();

    expect(result).toEqual({ userId: 'user-123' });
    expect(mockGetSession).toHaveBeenCalledOnce();
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously when no session exists and returns the new user id', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const newUser = { id: 'anon-456', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' };
    mockSignInAnonymously.mockResolvedValue({
      data: { session: { user: newUser } as Session, user: newUser },
      error: null,
    } as AuthResponse);

    const { getAnonSession } = await import('./supabaseClient');
    const result = await getAnonSession();

    expect(result).toEqual({ userId: 'anon-456' });
    expect(mockGetSession).toHaveBeenCalledOnce();
    expect(mockSignInAnonymously).toHaveBeenCalledOnce();
  });

  it('throws if getSession returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error('session error') });

    const { getAnonSession } = await import('./supabaseClient');
    await expect(getAnonSession()).rejects.toThrow('session error');
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it('throws if signInAnonymously returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInAnonymously.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('anon signin failed'),
    } as AuthResponse);

    const { getAnonSession } = await import('./supabaseClient');
    await expect(getAnonSession()).rejects.toThrow('anon signin failed');
  });

  it('throws if signInAnonymously succeeds but returns no user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInAnonymously.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as AuthResponse);

    const { getAnonSession } = await import('./supabaseClient');
    await expect(getAnonSession()).rejects.toThrow('No user returned from anonymous sign-in');
  });

  it('throws if existing session has no user', async () => {
    const fakeSession: Session = {
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      refresh_token: 'ref',
      user: null as unknown as Session['user'],
    };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession }, error: null });

    const { getAnonSession } = await import('./supabaseClient');
    await expect(getAnonSession()).rejects.toThrow('No user in existing session');
  });

  it('does not call signInAnonymously if getSession returns a session', async () => {
    const fakeSession: Session = {
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      refresh_token: 'ref',
      user: { id: 'existing-user', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' },
    };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession }, error: null });

    const { getAnonSession } = await import('./supabaseClient');
    await getAnonSession();

    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });
});
