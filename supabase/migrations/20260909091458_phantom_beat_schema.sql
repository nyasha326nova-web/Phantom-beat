/*
# Phantom Beat — Core Schema

## Overview
Creates the database tables, triggers, and storage bucket for Phantom Beat,
a private per-user music player. Each user gets their own private library
of uploaded audio tracks — enforced by Row Level Security on both the
tracks table and the storage bucket.

## New Tables

### profiles
- `id` (uuid, primary key, references auth.users ON DELETE CASCADE)
- `email` (text, not null — copied from auth.users at signup)
- `is_admin` (boolean, default false — manually flipped in dashboard)
- `created_at` (timestamptz, default now())

### tracks
- `id` (uuid, primary key)
- `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
- `title` (text, not null)
- `artist` (text, default 'Unknown Artist')
- `file_path` (text, not null — storage object path under songs/{user_id}/)
- `duration` (integer, nullable — seconds, populated client-side if available)
- `created_at` (timestamptz, default now())

## Triggers

### handle_new_user
AFTER INSERT on auth.users → inserts a matching row in `profiles`
with the user's id, email, and is_admin=false. The frontend never
creates this row.

## Storage

### songs bucket
A private storage bucket. Files are stored under `songs/{user_id}/filename`.
RLS policies on storage.objects ensure users can only CRUD their own
subfolder.

## Security

- RLS enabled on `profiles`, `tracks`, and `storage.objects` (for the songs bucket).
- profiles: users can SELECT and UPDATE their own profile row.
- tracks: full owner-scoped CRUD — SELECT, INSERT, UPDATE, DELETE scoped to auth.uid() = user_id.
- storage.objects (songs bucket): owner-scoped CRUD filtered by the
  {user_id}/ prefix in the file path.

## Important Notes
1. The `user_id` column on `tracks` defaults to `auth.uid()` so client
   inserts that omit user_id still satisfy the INSERT WITH CHECK policy.
2. The profiles trigger uses `security definer` so it can write to the
   profiles table during the auth.users insert before the user has any
   explicit grants.
3. Storage policies check that the file path starts with the caller's
   uid to enforce per-user isolation at the database layer.
*/

-- =============================================================
-- PROFILES TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================
-- AUTO-CREATE PROFILE TRIGGER
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- TRACKS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text NOT NULL DEFAULT 'Unknown Artist',
  file_path text NOT NULL,
  duration integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracks_select_own" ON public.tracks;
CREATE POLICY "tracks_select_own"
  ON public.tracks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tracks_insert_own" ON public.tracks;
CREATE POLICY "tracks_insert_own"
  ON public.tracks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tracks_update_own" ON public.tracks;
CREATE POLICY "tracks_update_own"
  ON public.tracks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tracks_delete_own" ON public.tracks;
CREATE POLICY "tracks_delete_own"
  ON public.tracks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON public.tracks(user_id);

-- =============================================================
-- STORAGE BUCKET
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('songs', 'songs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can only access objects under songs/{their_uid}/
DROP POLICY IF EXISTS "songs_select_own" ON storage.objects;
CREATE POLICY "songs_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'songs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "songs_insert_own" ON storage.objects;
CREATE POLICY "songs_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'songs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "songs_update_own" ON storage.objects;
CREATE POLICY "songs_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'songs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'songs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "songs_delete_own" ON storage.objects;
CREATE POLICY "songs_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'songs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================
-- ADMIN: list all profiles (for the admin panel)
-- Allow SELECT on all profiles only for admins via a SECURITY DEFINER function
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Allow admins to read all profiles
DROP POLICY IF EXISTS "profiles_select_all_for_admin" ON public.profiles;
CREATE POLICY "profiles_select_all_for_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());
