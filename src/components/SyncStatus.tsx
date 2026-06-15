import { useEffect, useState } from "react";
import { Cloud, CloudOff, LogOut } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../srs/supabase";
import { requestSignInCode, signOut, verifySignInCode } from "../srs/sync";

type Step = "closed" | "email" | "code";

export function SyncStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("closed");
  const [inputEmail, setInputEmail] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      if (session?.user.email) {
        setStep("closed");
        setInputEmail("");
        setInputCode("");
        setStatus(null);
      }
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

  if (step === "closed") {
    return (
      <button
        onClick={() => setStep("email")}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900"
      >
        <CloudOff size={12} />
        <span>Sign in to sync</span>
      </button>
    );
  }

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("Sending code…");
    const { error } = await requestSignInCode(inputEmail.trim());
    setBusy(false);
    if (error) {
      setStatus(`Error: ${error}`);
    } else {
      setStatus("Check your email for a 6-digit code.");
      setStep("code");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("Verifying…");
    const { error } = await verifySignInCode(inputEmail.trim(), inputCode.trim());
    setBusy(false);
    if (error) setStatus(`Error: ${error}`);
    // Success path is handled by the auth state listener above.
  };

  const cancel = () => {
    setStep("closed");
    setInputEmail("");
    setInputCode("");
    setStatus(null);
  };

  if (step === "email") {
    return (
      <form onSubmit={handleRequestCode} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={inputEmail}
          onChange={(e) => setInputEmail(e.target.value)}
          className="text-xs px-2 py-1 rounded border border-neutral-300 focus:outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="text-xs px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Send code
        </button>
        <button
          type="button"
          onClick={cancel}
          className="text-xs text-neutral-400 hover:text-neutral-700"
        >
          Cancel
        </button>
        {status && <span className="text-xs text-neutral-500 ml-2">{status}</span>}
      </form>
    );
  }

  // step === "code"
  return (
    <form onSubmit={handleVerifyCode} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        required
        autoFocus
        // iOS Mail surfaces 6-digit codes via the QuickType bar when the
        // input has type="text" + autocomplete="one-time-code" + inputmode
        // numeric. Tap-and-hold the suggestion in Mail to AutoFill here.
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="6-digit code"
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
        className="text-xs px-2 py-1 rounded border border-neutral-300 focus:outline-none focus:border-neutral-900 tracking-widest font-mono"
      />
      <button
        type="submit"
        disabled={busy || inputCode.length !== 6}
        className="text-xs px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        Verify
      </button>
      <button
        type="button"
        onClick={() => setStep("email")}
        className="text-xs text-neutral-400 hover:text-neutral-700"
      >
        Back
      </button>
      {status && <span className="text-xs text-neutral-500 ml-2">{status}</span>}
    </form>
  );
}
