-- Boligdata-legeplads: table for gallery submissions (Neon Data API).
--
-- Run in Neon Console > SQL Editor, after enabling the Data API with Neon Auth.
-- Use the filled-in copy that `node 05_krypter.mjs` writes to
-- boligdata/fuld/ud/neon_udfyldt.sql. This template has a placeholder instead
-- of the course-password hash, so it is safe to keep in the public repo.

create table if not exists public.indsendelser (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  navn        text not null check (char_length(navn) between 1 and 60),
  titel       text not null check (char_length(titel) between 1 and 100),
  kode        text not null check (char_length(kode) between 1 and 8000),
  billede     text not null check (billede like 'data:image/%' and char_length(billede) <= 600000),
  kursuskode  text not null,
  godkendt    boolean not null default false
);

alter table public.indsendelser enable row level security;

-- The web page talks to Neon as the `anonymous` role. It may insert rows that
-- are not approved and carry the right course code, and read approved rows.
-- Nothing else: no updates, no deletes, no reading the queue or the code.
revoke all on public.indsendelser from anonymous, authenticated;
grant usage on schema public to anonymous;
grant insert (navn, titel, kode, billede, kursuskode) on public.indsendelser to anonymous;
grant select (id, created_at, navn, titel, kode, billede, godkendt) on public.indsendelser to anonymous;

drop policy if exists indsend on public.indsendelser;
create policy indsend on public.indsendelser for insert to anonymous
  with check (godkendt = false and kursuskode = '__KURSUSKODE_HASH__');

drop policy if exists se_godkendte on public.indsendelser;
create policy se_godkendte on public.indsendelser for select to anonymous
  using (godkendt);

-- ---------------------------------------------------------------------------
-- Moderating
--   Neon Console > Tables > indsendelser: tick `godkendt` on the rows to show.
--   Or in the SQL Editor:
--     select id, created_at, navn, titel from indsendelser where not godkendt;
--     update indsendelser set godkendt = true where id = '...';
--     delete from indsendelser where id = '...';
--
-- Skip moderation (everything appears at once):
--     alter table indsendelser alter column godkendt set default true;
--     drop policy indsend on indsendelser;
--     create policy indsend on indsendelser for insert to anonymous
--       with check (kursuskode = '<same hash as above>');
