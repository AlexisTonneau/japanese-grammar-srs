-- Schema for the optional Supabase backend.
-- Apply once via the Supabase SQL editor (Project → SQL → New query).
--
-- Tables are user-scoped via Row Level Security: every row has a user_id
-- column that must match auth.uid(). Without RLS, the anon key — which
-- ships in the bundled JS — would let anyone read/write any row.

create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  interval integer not null,
  ease_factor real not null,
  next_review_date timestamptz not null,
  last_reviewed_at timestamptz,
  review_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists progress_user_idx on public.progress(user_id);

alter table public.progress enable row level security;

create policy "users see their own progress"
  on public.progress for select
  using (auth.uid() = user_id);

create policy "users insert their own progress"
  on public.progress for insert
  with check (auth.uid() = user_id);

create policy "users update their own progress"
  on public.progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete their own progress"
  on public.progress for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------

create table if not exists public.active_chapters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chapters integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.active_chapters enable row level security;

create policy "users see their own active_chapters"
  on public.active_chapters for select
  using (auth.uid() = user_id);

create policy "users insert their own active_chapters"
  on public.active_chapters for insert
  with check (auth.uid() = user_id);

create policy "users update their own active_chapters"
  on public.active_chapters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------
-- Append-only review log. One row per grade. Powers the stats dashboard
-- (heatmap, streaks, grade distribution). The (user_id, item_id, reviewed_at)
-- composite primary key gives us idempotent upserts: re-pulling and
-- re-pushing the same review is a no-op.

create table if not exists public.reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  grade text not null check (grade in ('forgot', 'understood', 'easy')),
  reviewed_at timestamptz not null,
  primary key (user_id, item_id, reviewed_at)
);

create index if not exists reviews_user_time_idx
  on public.reviews(user_id, reviewed_at desc);

alter table public.reviews enable row level security;

create policy "users see their own reviews"
  on public.reviews for select
  using (auth.uid() = user_id);

create policy "users insert their own reviews"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "users delete their own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id);
