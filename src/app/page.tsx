'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAnonSession } from '@/lib/supabaseClient';
import { createRoom, joinRoom } from '@/lib/rooms';
import { Button, GlassPanel } from '@/components/ui';

const NAME_KEY = 'decrypt.displayName';

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Establish the anonymous session up front; prefill a remembered name.
    void getAnonSession().catch(() => setError('Could not start a session. Please refresh.'));
    const saved = typeof window !== 'undefined' ? localStorage.getItem(NAME_KEY) : null;
    if (saved) setName(saved);
  }, []);

  const remember = (n: string) => {
    if (typeof window !== 'undefined') localStorage.setItem(NAME_KEY, n);
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError('Enter a display name first.');
    setBusy('create');
    setError(null);
    try {
      remember(name.trim());
      const { room } = await createRoom(name.trim());
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create room');
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError('Enter a display name first.');
    if (code.trim().length !== 6) return setError('Room codes are 6 characters.');
    setBusy('join');
    setError(null);
    try {
      remember(name.trim());
      const { room } = await joinRoom(code.trim(), name.trim());
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join room');
      setBusy(null);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <header className="text-center">
        <h1 className="font-mono text-5xl font-bold tracking-[0.2em] text-cyan drop-shadow-[0_0_20px_var(--color-cyan-glow)]">
          DECRYPT
        </h1>
        <p className="mt-2 max-w-md text-fg-muted">
          A real-time spy word game. Two teams race to identify their agents from one-word clues.
        </p>
      </header>

      <GlassPanel className="flex w-full max-w-md flex-col gap-5 p-6">
        <label className="flex flex-col gap-1 text-sm font-semibold text-fg-muted">
          Display name
          <input
            type="text"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="min-h-11 rounded-xl border border-border bg-surface px-3 text-base text-fg focus-visible:outline focus-visible:outline-3 focus-visible:outline-ring"
          />
        </label>

        <Button onClick={handleCreate} disabled={busy !== null} size="lg">
          {busy === 'create' ? 'Creating…' : 'Create room'}
        </Button>

        <div className="flex items-center gap-3 text-xs uppercase text-fg-muted">
          <span className="h-px flex-1 bg-border" /> or join <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            aria-label="Room code"
            className="min-h-11 w-32 rounded-xl border border-border bg-surface px-3 text-center font-mono text-lg uppercase tracking-[0.3em] text-fg focus-visible:outline focus-visible:outline-3 focus-visible:outline-ring"
          />
          <Button variant="ghost" onClick={handleJoin} disabled={busy !== null} className="flex-1">
            {busy === 'join' ? 'Joining…' : 'Join'}
          </Button>
        </div>

        {error && <p className="text-sm text-error" role="alert">{error}</p>}
      </GlassPanel>
    </main>
  );
}
