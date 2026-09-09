/*
# Phantom Beat — Lock Trigger Function RPC Access

## Overview
The new-user profile trigger is only invoked by PostgreSQL when a user is
created. It is not an application API and must not be callable through the
Supabase REST RPC surface.

## Security Changes
- Revoke EXECUTE on `public.handle_new_user()` from PUBLIC, anon, and authenticated.

## Important Notes
1. The auth trigger continues to invoke the function normally.
2. No user-facing feature depends on calling this function directly.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
