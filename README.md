# Foodie

Family dinner planner + shared grocery list. Static app (`index.html`) with two Vercel functions:

- `api/claude.js` — proxies Claude API calls (needs `ANTHROPIC_API_KEY`)
- `api/state.js` — shared household state in Supabase (needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOODIE_PASSCODE`)

## One-time setup

1. **Supabase** → new project → SQL Editor → run `supabase.sql`.
   Project Settings → API: copy the **Project URL** and the **service_role** key (not anon).
2. **Vercel** → Project → Settings → Environment Variables (all environments):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
   - `SUPABASE_URL` — the Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key
   - `FOODIE_PASSCODE` — anything you and Jerusha will type once per phone
3. **Redeploy** after adding env vars (Deployments → ⋯ → Redeploy). Env changes don't apply until you do.
4. Open the site on each phone, enter the passcode, and "Add to Home Screen".

## Notes
- The list, plan, staples, purchases, and settings are all shared between phones (polled every 20s).
- Gmail receipt sync only works inside Claude; use "Paste receipt" on the hosted app.
- Never commit the service_role key — it lives only in Vercel env vars.
