/*
# Phantom Beat — Protect Profile Privilege Fields

## Overview
Prevents signed-in users from changing their own administrative flag or
profile email through the browser data API. The application does not need
profile editing, so profile updates are removed entirely.

## Security Changes
1. Revoke UPDATE access on profiles from authenticated users.
2. Remove the unused self-update policy.
3. Restrict the admin-check function to authenticated callers only.

## Important Notes
- The `is_admin` value can only be changed by a trusted dashboard/service role.
- Account deletion remains available only through the admin-checked edge function.
*/

REVOKE UPDATE ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
