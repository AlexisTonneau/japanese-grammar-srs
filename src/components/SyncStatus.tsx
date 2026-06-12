import { useEffect, useState } from "react";
import { Cloud, CloudOff, LogOut } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../srs/supabase";
import { signInWithEmail, signOut } from "../srs/sync";

export function SyncStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [inputEmail, setInputEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-neutral-400"
        title="Supabase is not configured. Progress is saved locally only."
      >
        <CloudOff size={12} />
        <span>Local only</span>
      </div>
    );
  }

  if (email) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Cloud size={12} className="text-emerald-600" />
        <span>{email}</span>
        <button
          onClick={() => signOut()}
          className="text-neutral-400 hover:text-neutral-700"
          title="Sign out"
        >
          <LogOut size={12} />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900"
      >
        <CloudOff size={12} />
        <span>Sign in to sync</span>
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Sending magic link...");
    const { error } = await signInWithEmail(inputEmail.trim());
    if (error) {
      setStatus(`Error: ${error}`);
    } else {
      setStatus("Check your email for a magic link.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="email"
        required
        autoFocus
        placeholder="you@example.com"
        value={inputEmail}
        onChange={(e) => setInputEmail(e.target.value)}
        className="text-xs px-2 py-1 rounded border border-neutral-300 focus:outline-none focus:border-neutral-900"
      />
      <button
        type="submit"
        className="text-xs px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800"
      >
        Send link
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setStatus(null);
        }}
        className="text-xs text-neutral-400 hover:text-neutral-700"
      >
        Cancel
      </button>
      {status && (
        <span className="text-xs text-neutral-500 ml-2">{status}</span>
      )}
    </form>
  );
}
