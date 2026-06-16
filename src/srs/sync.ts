// Background sync between localStorage (source of truth for the running UI)
// and Supabase (durable cross-device store). Local-first: every write hits
// localStorage immediately; Supabase writes happen async, retried on failure.
//
// The dispatchChange notifier from storage.ts is reused so the rest of the
// app can stay agnostic about whether Supabase is wired up at all.

import type { Progress, ReviewLogEntry } from "./types";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { ProgressRow, ReviewRow } from "./supabase";
import {
  localProgressStore,
  readActiveChapters,
  readReviewLog,
  writeActiveChapters,
  writeReviewLog,
} from "./storage";

const PROGRESS_TABLE = "progress";
const ACTIVE_TABLE = "active_chapters";
const REVIEWS_TABLE = "reviews";

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

      // Reviews — append-only log, dedupe by (item_id, reviewed_at).
      // We pull everything; for a personal app the log will fit easily.
      const { data: reviewRows, error: reviewErr } = await supabase
        .from(REVIEWS_TABLE)
        .select("*")
        .eq("user_id", currentUserId)
        .order("reviewed_at", { ascending: true });
      if (reviewErr) {
        console.warn("supabase: pull reviews failed", reviewErr);
      } else {
        const localLog = readReviewLog();
        const seen = new Set(
          localLog.map((e) => `${e.itemId}|${e.reviewedAt}`)
        );
        const merged = [...localLog];
        const toPushUp: ReviewLogEntry[] = [];
        for (const row of reviewRows ?? []) {
          const r = row as ReviewRow;
          const key = `${r.item_id}|${r.reviewed_at}`;
          if (!seen.has(key)) {
            merged.push({
              itemId: r.item_id,
              grade: r.grade,
              reviewedAt: r.reviewed_at,
            });
            seen.add(key);
          }
        }
        // Local entries missing from remote: push up.
        const remoteSet = new Set(
          (reviewRows ?? []).map(
            (r) => `${(r as ReviewRow).item_id}|${(r as ReviewRow).reviewed_at}`
          )
        );
        for (const e of localLog) {
          if (!remoteSet.has(`${e.itemId}|${e.reviewedAt}`)) {
            toPushUp.push(e);
          }
        }
        if (merged.length !== localLog.length) {
          merged.sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
          writeReviewLog(merged);
        }
        if (toPushUp.length > 0) {
          await pushReviewBatch(toPushUp);
        }
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

export async function pushReview(entry: ReviewLogEntry): Promise<void> {
  if (!supabase || !currentUserId) return;
  const { error } = await supabase.from(REVIEWS_TABLE).upsert(
    {
      user_id: currentUserId,
      item_id: entry.itemId,
      grade: entry.grade,
      reviewed_at: entry.reviewedAt,
    },
    { onConflict: "user_id,item_id,reviewed_at", ignoreDuplicates: true }
  );
  if (error) console.warn("supabase: push review failed", error);
}

async function pushReviewBatch(entries: ReviewLogEntry[]): Promise<void> {
  if (!supabase || !currentUserId || entries.length === 0) return;
  const rows = entries.map((e) => ({
    user_id: currentUserId,
    item_id: e.itemId,
    grade: e.grade,
    reviewed_at: e.reviewedAt,
  }));
  const { error } = await supabase
    .from(REVIEWS_TABLE)
    .upsert(rows, {
      onConflict: "user_id,item_id,reviewed_at",
      ignoreDuplicates: true,
    });
  if (error) console.warn("supabase: push review batch failed", error);
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
//
// We deliberately avoid email-based auth because magic links don't work on
// iOS PWAs (Safari has a separate storage origin from home-screen PWAs) and
// editing email templates to use OTP codes is locked behind custom SMTP on
// Supabase free projects.
//
// Instead: anonymous sign-in. Device 1 calls signInAnonymously() to mint an
// auth.users row with a UUID. To sync to device 2, we export the session's
// refresh token as a paste-able code; device 2 calls setSession() with that
// token, and both devices then share the same auth.uid() — RLS keeps working
// unchanged.
//
// This requires two project-level Supabase settings:
//   - Auth → Sign In/Up → Anonymous Sign-Ins: ON
//   - Auth → Sessions → Refresh Token Rotation: OFF (otherwise token rotation
//     invalidates one device when the other refreshes).

export async function enableSync(): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.auth.signInAnonymously();
  return error ? { error: error.message } : {};
}

// Returns the current refresh token, base64-encoded so it's safe to paste
// across devices via password manager / AirDrop / etc. Returns null if no
// session is active.
export async function getSyncCode(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const refresh = data.session?.refresh_token;
  if (!refresh) return null;
  // btoa is fine here — refresh tokens are ASCII.
  return btoa(JSON.stringify({ v: 1, refresh_token: refresh }));
}

export async function redeemSyncCode(
  code: string
): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase not configured" };
  let refreshToken: string;
  try {
    const decoded = JSON.parse(atob(code.trim()));
    if (decoded.v !== 1 || typeof decoded.refresh_token !== "string") {
      return { error: "Unrecognized sync code format" };
    }
    refreshToken = decoded.refresh_token;
  } catch {
    return { error: "Couldn't parse sync code — check for paste artifacts" };
  }
  // refreshSession exchanges the token for a fresh access+refresh pair and
  // installs the result as the active session.
  const { error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
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
