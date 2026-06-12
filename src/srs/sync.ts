// Background sync between localStorage (source of truth for the running UI)
// and Supabase (durable cross-device store). Local-first: every write hits
// localStorage immediately; Supabase writes happen async, retried on failure.
//
// The dispatchChange notifier from storage.ts is reused so the rest of the
// app can stay agnostic about whether Supabase is wired up at all.

import type { Progress } from "./types";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { ProgressRow } from "./supabase";
import {
  localProgressStore,
  readActiveChapters,
  writeActiveChapters,
} from "./storage";

const PROGRESS_TABLE = "progress";
const ACTIVE_TABLE = "active_chapters";

let currentUserId: string | null = null;
let pullInFlight: Promise<void> | null = null;

export function isSyncEnabled(): boolean {
  return isSupabaseConfigured && currentUserId !== null;
}

export async function initSync(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  currentUserId = data.session?.user.id ?? null;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const newId = session?.user.id ?? null;
    if (newId === currentUserId) return;
    currentUserId = newId;
    if (newId) {
      await pullAll();
    }
  });

  if (currentUserId) {
    await pullAll();
  }
}

// Pull remote state and merge into local. Last-write-wins: any remote row
// newer than what's in localStorage replaces the local entry. Local rows
// without a remote counterpart are pushed up.
export async function pullAll(): Promise<void> {
  if (!supabase || !currentUserId) return;
  if (pullInFlight) return pullInFlight;

  pullInFlight = (async () => {
    try {
      const { data: rows, error } = await supabase
        .from(PROGRESS_TABLE)
        .select("*")
        .eq("user_id", currentUserId);
      if (error) {
        console.warn("supabase: pull progress failed", error);
        return;
      }

      const localMap = localProgressStore.all();
      const remoteMap = new Map<string, ProgressRow>();
      for (const row of rows ?? []) remoteMap.set(row.item_id, row as ProgressRow);

      // Merge remote → local
      for (const [itemId, row] of remoteMap) {
        const local = localMap[itemId];
        const remoteUpdated = new Date(row.updated_at).getTime();
        const localUpdated = local
          ? new Date(local.lastReviewedAt ?? 0).getTime()
          : 0;
        if (!local || remoteUpdated > localUpdated) {
          localProgressStore.set(rowToProgress(row));
        }
      }

      // Push local-only rows up
      const toPush: Progress[] = [];
      for (const [itemId, progress] of Object.entries(localMap)) {
        if (!remoteMap.has(itemId)) toPush.push(progress);
      }
      if (toPush.length > 0) {
        await pushProgressBatch(toPush);
      }

      // Active chapters
      const { data: activeRow } = await supabase
        .from(ACTIVE_TABLE)
        .select("*")
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (activeRow) {
        const remoteUpdated = new Date(activeRow.updated_at).getTime();
        const localStored = localStorage.getItem("minna-srs:active-chapters:meta");
        const localUpdated = localStored
          ? Number(localStored)
          : 0;
        if (remoteUpdated > localUpdated) {
          writeActiveChapters(activeRow.chapters);
          localStorage.setItem(
            "minna-srs:active-chapters:meta",
            String(remoteUpdated)
          );
        } else {
          await pushActiveChapters(readActiveChapters());
        }
      } else {
        // Nothing remote — push current local state
        await pushActiveChapters(readActiveChapters());
      }
    } finally {
      pullInFlight = null;
    }
  })();

  return pullInFlight;
}

export async function pushProgress(progress: Progress): Promise<void> {
  if (!supabase || !currentUserId) return;
  const { error } = await supabase.from(PROGRESS_TABLE).upsert(
    {
      user_id: currentUserId,
      item_id: progress.itemId,
      interval: progress.interval,
      ease_factor: progress.easeFactor,
      next_review_date: progress.nextReviewDate,
      last_reviewed_at: progress.lastReviewedAt,
      review_count: progress.reviewCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id" }
  );
  if (error) console.warn("supabase: push progress failed", error);
}

async function pushProgressBatch(items: Progress[]): Promise<void> {
  if (!supabase || !currentUserId || items.length === 0) return;
  const now = new Date().toISOString();
  const rows = items.map((p) => ({
    user_id: currentUserId,
    item_id: p.itemId,
    interval: p.interval,
    ease_factor: p.easeFactor,
    next_review_date: p.nextReviewDate,
    last_reviewed_at: p.lastReviewedAt,
    review_count: p.reviewCount,
    updated_at: now,
  }));
  const { error } = await supabase
    .from(PROGRESS_TABLE)
    .upsert(rows, { onConflict: "user_id,item_id" });
  if (error) console.warn("supabase: push batch failed", error);
}

export async function pushActiveChapters(chapters: number[]): Promise<void> {
  if (!supabase || !currentUserId) return;
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from(ACTIVE_TABLE)
    .upsert(
      { user_id: currentUserId, chapters, updated_at: updatedAt },
      { onConflict: "user_id" }
    );
  if (error) {
    console.warn("supabase: push active chapters failed", error);
    return;
  }
  localStorage.setItem(
    "minna-srs:active-chapters:meta",
    String(new Date(updatedAt).getTime())
  );
}

function rowToProgress(row: ProgressRow): Progress {
  return {
    itemId: row.item_id,
    interval: row.interval,
    easeFactor: row.ease_factor,
    nextReviewDate: row.next_review_date,
    lastReviewedAt: row.last_reviewed_at,
    reviewCount: row.review_count,
  };
}

// ---- auth helpers ----

export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  currentUserId = null;
}

export function getCurrentUserEmail(): string | null {
  // Synchronous accessor for UI; real source-of-truth is the supabase client.
  if (!supabase) return null;
  // Use the cached session to avoid an async call in render paths.
  const session = (supabase.auth as unknown as {
    currentSession?: { user?: { email?: string } };
  }).currentSession;
  return session?.user?.email ?? null;
}

export async function getCurrentUserEmailAsync(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}
