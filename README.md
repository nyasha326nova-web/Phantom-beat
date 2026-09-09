# Phantom Beat

A private music player powered by Supabase.

## Vercel environment variables

Set these in the Vercel project settings:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anonymous key

The account deletion action runs as a Supabase Edge Function and uses the project's server-side service role secret automatically. Never expose that secret in the browser.

After creating your first account, manually set `profiles.is_admin` to `true` for that account in the Supabase dashboard to enable the Accounts panel.
