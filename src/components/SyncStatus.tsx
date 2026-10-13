import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Cloud, CloudOff, KeyRound, Loader2, LogOut } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../srs/supabase";
import {
  getSyncStatus,
  onSyncStatusChange,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  upgradeAnonymousAccount,
  type SyncStatus as SyncActivity,
} from "../srs/sync";

type Step = "closed" | "signin" | "signup" | "upgrade";

interface SyncUser {
  id: string;
  email: string | null;
}

export function SyncStatus() {
  const [user, setUser] = useState<SyncUser | null>(null);
  const [step, setStep] = useState<Step>("closed");
  const [activity, setActivity] = useState<SyncActivity>(() => getSyncStatus());

  useEffect(() => {
    return onSyncStatusChange(setActivity);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const toSyncUser = (u: { id: string; email?: string } | undefined) =>
      u ? { id: u.id, email: u.email || null } : null;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(toSyncUser(data.session?.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toSyncUser(session?.user));
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

  const close = () => setStep("closed");

  if (user) {
    if (step === "upgrade") {
      return (
        <CredentialsForm
          intro="Add an email and password to this account, then use them to sign in on your other devices."
          submitLabel="Save"
          passwordAutoComplete="new-password"
          onSubmit={upgradeAnonymousAccount}
          onSuccess={close}
        >
          <button
            type="button"
            onClick={close}
            className="text-neutral-400 hover:text-neutral-700"
          >
            Cancel
          </button>
        </CredentialsForm>
      );
    }

    const needsPassword = user.email === null;

    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        {activity === "syncing" ? (
          <>
            <Loader2 size={12} className="text-neutral-400 animate-spin" />
            <span>Syncing…</span>
          </>
        ) : (
          <>
            <Cloud size={12} className="text-emerald-600" />
            <span>Synced</span>
          </>
        )}
        {needsPassword && (
          <button
            onClick={() => setStep("upgrade")}
            className="flex items-center gap-1 text-amber-700 hover:text-amber-900 underline-offset-4 hover:underline"
            title="This account has no password yet, so other devices can't sign in to it"
          >
            <KeyRound size={12} /> Set password
          </button>
        )}
        <button
          onClick={() => {
            if (
              needsPassword &&
              !window.confirm(
                "This account has no password yet. After signing out you won't be able to sign back in to it. Sign out anyway?"
              )
            ) {
              return;
            }
            signOut();
          }}
          className="text-neutral-400 hover:text-neutral-700"
          title={user.email ? `Sign out (${user.email})` : "Sign out"}
        >
          <LogOut size={12} />
        </button>
      </div>
    );
  }

  if (step === "closed" || step === "upgrade") {
    return (
      <button
        onClick={() => setStep("signin")}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900"
      >
        <CloudOff size={12} />
        <span>Sign in to sync</span>
      </button>
    );
  }

  const isSignUp = step === "signup";

  return (
    <CredentialsForm
      key={step}
      intro={
        isSignUp
          ? "Create an account to sync your progress across devices."
          : "Sign in to sync your progress across devices."
      }
      submitLabel={isSignUp ? "Create account" : "Sign in"}
      passwordAutoComplete={isSignUp ? "new-password" : "current-password"}
      onSubmit={isSignUp ? signUpWithPassword : signInWithPassword}
      onSuccess={close}
    >
      <button
        type="button"
        onClick={() => setStep(isSignUp ? "signin" : "signup")}
        className="text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
      >
        {isSignUp ? "I already have an account" : "Create account"}
      </button>
      <button
        type="button"
        onClick={close}
        className="text-neutral-400 hover:text-neutral-700"
      >
        Cancel
      </button>
    </CredentialsForm>
  );
}

interface CredentialsFormProps {
  intro: string;
  submitLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
  onSubmit: (email: string, password: string) => Promise<{ error?: string }>;
  onSuccess: () => void;
  children?: ReactNode;
}

function CredentialsForm({
  intro,
  submitLabel,
  passwordAutoComplete,
  onSubmit,
  onSuccess,
  children,
}: CredentialsFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await onSubmit(email, password);
    setBusy(false);
    if (result.error) setError(result.error);
    else onSuccess();
  };

  const inputClass =
    "text-base px-2 py-1 rounded border border-neutral-300 focus:outline-none focus:border-neutral-900";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 text-xs">
      <div className="text-neutral-700">{intro}</div>
      <input
        type="email"
        required
        autoFocus
        autoComplete="username"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <input
        type="password"
        required
        minLength={6}
        autoComplete={passwordAutoComplete}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          {submitLabel}
        </button>
        {children}
      </div>
      {error && <span className="text-neutral-500">Error: {error}</span>}
    </form>
  );
}
