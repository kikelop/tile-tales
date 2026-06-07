-- Tile Tales — initial schema (v1: personal sync, no social)
-- Mirrors the local store model (app/src/lib/store.ts).
-- Sample tiles (t1..t14) share ids across users, so every table keys on (user_id, id).

-- ============ tiles ============
create table public.tiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null, -- client-generated (crypto.randomUUID, or t1..t14 for bundled samples)
  name text not null default '',
  -- '/tiles/x.webp' for bundled samples, 'storage:<user_id>/<tile_id>.webp' for captures
  image_ref text not null,
  memory text not null default '',
  date text not null default '',
  tags text[] not null default '{}',
  favorite boolean not null default false,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz, -- soft delete so deletions propagate to other devices
  primary key (user_id, id)
);

-- ============ albums ============
create table public.albums (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null, -- client-generated
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- ============ album_tiles (membership) ============
create table public.album_tiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  album_id text not null,
  tile_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, album_id, tile_id),
  foreign key (user_id, album_id) references public.albums (user_id, id) on delete cascade,
  foreign key (user_id, tile_id) references public.tiles (user_id, id) on delete cascade
);

-- ============ updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tiles_updated_at before update on public.tiles
  for each row execute function public.set_updated_at();
create trigger albums_updated_at before update on public.albums
  for each row execute function public.set_updated_at();

-- ============ RLS: each user only sees their own rows ============
alter table public.tiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_tiles enable row level security;

create policy "own tiles" on public.tiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own albums" on public.albums
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own album_tiles" on public.album_tiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ storage: private bucket for captured tile images ============
insert into storage.buckets (id, name, public)
values ('tiles', 'tiles', false);

-- Path convention: <user_id>/<tile_id>.webp — owner-only access
create policy "own tile images read" on storage.objects
  for select using (bucket_id = 'tiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own tile images insert" on storage.objects
  for insert with check (bucket_id = 'tiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own tile images update" on storage.objects
  for update using (bucket_id = 'tiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own tile images delete" on storage.objects
  for delete using (bucket_id = 'tiles' and (storage.foldername(name))[1] = auth.uid()::text);
