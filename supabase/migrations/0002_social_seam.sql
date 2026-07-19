-- Tile Tales — social seam (still personal-only; no social features shipped)
-- Purpose: make the eventual community map an ADDITIVE change, not a rewrite.
-- The row already carries user_id (0001), so attribution ("who found this tile")
-- is already possible. The only thing missing to go public is an opt-in flag.

-- Opt-in publish flag. Default false → nothing is public, behaviour unchanged.
alter table public.tiles
  add column if not exists is_public boolean not null default false;

-- ============================================================================
-- FUTURE (v2 community map) — DO NOT ENABLE YET. Left here as documentation so
-- the path is obvious. When social ships, the ONLY change needed to open reads
-- is to ADD this policy (the existing "own tiles" policy keeps write ownership):
--
--   create policy "public tiles are readable" on public.tiles
--     for select using (is_public = true);
--
-- Storage images for public tiles would get an equivalent public-read policy
-- scoped to is_public rows, plus likes/saves tables + moderation. None of that
-- exists yet — this migration only reserves the column.
-- ============================================================================
