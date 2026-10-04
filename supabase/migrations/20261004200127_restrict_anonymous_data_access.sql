/*
# Restrict anonymous data access

## Overview
Removes unnecessary anonymous Data API privileges from Phantom Beat's private
application tables and private song storage. Signed-in users continue to use
the existing owner-scoped policies.

## Security Changes
- Anonymous callers can no longer access profiles, tracks, or storage objects
  through the Data API.
- Signed-in users retain the existing track and song-storage access rules.
- Profile writes remain unavailable to signed-in users because profiles are
  maintained by the authentication trigger and trusted admin operations.

## Important Notes
1. Row-level security remains enabled and continues to enforce ownership.
2. This is defense in depth: the current anonymous requests already have no
   matching application policies, but the broad table grants are removed.
*/

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
REVOKE ALL ON TABLE public.tracks FROM anon;
REVOKE ALL ON TABLE storage.objects FROM anon;
