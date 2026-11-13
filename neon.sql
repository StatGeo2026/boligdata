-- Boligdata-legeplads: table for gallery submissions (Neon Data API).
--
-- Run in Neon Console > SQL Editor, after enabling the Data API with Neon Auth.
-- Use the filled-in copy that `node 05_krypter.mjs` writes to
-- boligdata/fuld/ud/neon_udfyldt.sql. This template has a placeholder instead
-- of the course-password hash, so it is safe to keep in the public repo.
-- The script can be rerun; it keeps existing submissions.
--
-- The web page talks to Neon as the `anonymous` role. It may
--   * insert rows into `indsendelser` (only with the right course code), and
--   * read the view `galleri`, which only has rows with `godkendt`.
-- Nothing else: no updates, no deletes, no reading the course code, and no
-- setting `godkendt` (the column default decides).
--
-- New submissions are public at once (`godkendt` defaults to true). Untick
-- `godkendt` to hide one. To require approval again, see the end of the file.
--
-- This does not depend on row-level security (RLS): the `where godkendt`
-- filter sits in the view, and a trigger checks every insert. RLS is still on
-- as an extra layer, so if the console shows a toggle for it, leave it on.

create table if not exists public.indsendelser (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  navn        text not null check (char_length(navn) between 1 and 60),
  titel       text not null check (char_length(titel) between 1 and 100),
  kode        text not null check (char_length(kode) between 1 and 8000),
  billede     text not null check (billede like 'data:image/%' and char_length(billede) <= 600000),
  kursuskode  text not null,
  godkendt    boolean not null default true
);
alter table public.indsendelser alter column godkendt set default true;

-- What the page reads. The view runs with its owner's rights, so anonymous
-- needs no access to the table itself to see approved rows.
create or replace view public.galleri as
  select id, created_at, navn, titel, kode, billede
  from public.indsendelser
  where godkendt;

-- Student inserts need the right course code. Inserts by the owner (Neon
-- Console) are not checked.
create or replace function public.indsendelse_tjek() returns trigger
language plpgsql as $$
begin
  if current_user in ('anonymous', 'authenticated') then
    if new.kursuskode is distinct from '__KURSUSKODE_HASH__' then
      raise exception 'forkert kursuskode' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.indsendelse_tjek() from public;

drop trigger if exists indsendelse_tjek on public.indsendelser;
create trigger indsendelse_tjek before insert on public.indsendelser
  for each row execute function public.indsendelse_tjek();

-- Privileges.
revoke all on public.indsendelser from public, anonymous, authenticated;
revoke all on public.galleri from public, anonymous, authenticated;
grant usage on schema public to anonymous;
grant insert (navn, titel, kode, billede, kursuskode) on public.indsendelser to anonymous;
grant select on public.galleri to anonymous;

-- Row-level security, as a second layer for inserts.
alter table public.indsendelser enable row level security;

drop policy if exists indsend on public.indsendelser;
create policy indsend on public.indsendelser for insert to anonymous
  with check (kursuskode = '__KURSUSKODE_HASH__');

drop policy if exists se_godkendte on public.indsendelser;

-- ---------------------------------------------------------------------------
-- Moderating
--   Neon Console > Tables > indsendelser: untick `godkendt` to hide a figure.
--   Or in the SQL Editor:
--     select id, created_at, navn, titel, godkendt from indsendelser;
--     update indsendelser set godkendt = false where id = '...';
--     delete from indsendelser where id = '...';
--
-- Require approval before figures appear (new rows hidden until you tick
-- `godkendt`): change the default in this file to false and rerun it, or run
--     alter table indsendelser alter column godkendt set default false;
