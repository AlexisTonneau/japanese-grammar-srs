import { useEffect, useState } from "react";
import { Cloud, CloudOff, Copy, Loader2, LogOut } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../srs/supabase";
import {
  enableSync,
  getSyncCode,
  getSyncStatus,
  onSyncStatusChange,
  redeemSyncCode,
  signOut,
  type SyncStatus as SyncActivity,
} from "../srs/sync";

type Step = "closed" | "menu" | "redeem" | "share";

export function SyncStatus() {
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("closed");
  const [code, setCode] = useState("");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<SyncActivity>(() => getSyncStatus());

  useEffect(() => {
    return onSyncStatusChange(setActivity);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      if (session?.user.id) {
        setStep("closed");
        setCode("");
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

  // Signed in
  if (userId) {
    if (step === "share" && shareCode) {
      return (
        <div className="flex flex-col gap-2 text-xs">
          <div className="text-neutral-700">
            Paste this code on another device's "Sync from another device" form.
            Anyone with the code gets full access — keep it private.
          </div>
          <textarea
            readOnly
            value={shareCode}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            className="font-mono text-[10px] p-2 rounded border border-neutral-300 bg-neutral-50 break-all"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareCode);
                  setStatus("Copied.");
                } catch {
                  setStatus("Couldn't copy — select and copy manually.");
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Copy size={12} /> Copy
            </button>
            <button
              onClick={() => {
                setStep("closed");
                setShareCode(null);
                setStatus(null);
              }}
              className="text-neutral-400 hover:text-neutral-700"
            >
              Done
            </button>
            {status && <span className="text-neutral-500 ml-2">{status}</span>}
          </div>
        </div>
      );
    }

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
        <button
          onClick={async () => {
            const c = await getSyncCode();
            if (!c) {
              setStatus("No active session.");
              return;
            }
            setShareCode(c);
            setStep("share");
          }}
          className="text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline"
        >
          Add device
        </button>
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

  // Signed out
  if (step === "closed") {
    return (
      <button
        onClick={() => setStep("menu")}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900"
      >
        <CloudOff size={12} />
        <span>Sign in to sync</span>
      </button>
    );
  }

  const handleEnable = async () => {
    setBusy(true);
    setStatus("Setting up sync…");
    const { error } = await enableSync();
    setBusy(false);
    if (error) setStatus(`Error: ${error}`);
    // Success path handled by auth listener.
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("Verifying code…");
    const { error } = await redeemSyncCode(code);
    setBusy(false);
    if (error) setStatus(`Error: ${error}`);
    // Success path handled by auth listener.
  };

  if (step === "menu") {
    return (
      <div className="flex flex-col gap-2 text-xs">
        <div className="text-neutral-700">
          Sync your progress across devices.
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleEnable}
            disabled={busy}
            className="px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Enable sync (this is my first device)
          </button>
          <button
            onClick={() => setStep("redeem")}
            className="px-2 py-1 rounded border border-neutral-300 text-neutral-700 hover:border-neutral-500"
          >
            I have a sync code from another device
          </button>
          <button
            onClick={() => {
              setStep("closed");
              setStatus(null);
            }}
            className="text-neutral-400 hover:text-neutral-700"
          >
            Cancel
          </button>
        </div>
        {status && <span className="text-neutral-500">{status}</span>}
      </div>
    );
  }

  // step === "redeem"
  return (
    <form onSubmit={handleRedeem} className="flex flex-col gap-2 text-xs">
      <div className="text-neutral-700">
        Paste the sync code from your other device.
      </div>
      <textarea
        required
        autoFocus
        placeholder="Paste your sync code…"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="font-mono text-[10px] p-2 rounded border border-neutral-300 focus:outline-none focus:border-neutral-900 break-all"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || code.trim().length === 0}
          className="px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Sync this device
        </button>
        <button
          type="button"
          onClick={() => setStep("menu")}
          className="text-neutral-400 hover:text-neutral-700"
        >
          Back
        </button>
        {status && <span className="text-neutral-500 ml-2">{status}</span>}
      </div>
    </form>
  );
}
