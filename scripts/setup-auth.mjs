#!/usr/bin/env node
/**
 * Prints Supabase Auth configuration checklist for ReserveEazy.
 * Run: npm run setup:auth
 */
console.log(`
ReserveEazy — Supabase Auth setup checklist
Project ref: terktsddtkazlyxgdzdz
Dashboard: https://supabase.com/dashboard/project/terktsddtkazlyxgdzdz

1. Authentication → Providers → Email
   - Enable Email provider
   - For dev: disable "Confirm email" for faster testing
   - For prod: enable "Confirm email"

2. Authentication → URL Configuration
   - Site URL (dev): http://localhost:3000
   - Site URL (prod): https://your-vercel-domain.vercel.app
   - Redirect URLs:
       http://localhost:3000/**
       https://your-vercel-domain.vercel.app/**

3. Authentication → Password Security (recommended for prod)
   - Enable leaked password protection
   https://supabase.com/docs/guides/auth/password-security

4. Optional: Authentication → SMTP Settings
   - Configure custom SMTP (Resend, SendGrid) for branded emails

5. Deploy via GitHub → Vercel
   - Push this repo to GitHub
   - Import at https://vercel.com/new
   - Add environment variables in Vercel project settings:
       NEXT_PUBLIC_SUPABASE_URL
       NEXT_PUBLIC_SUPABASE_ANON_KEY
   - After first deploy, update Supabase redirect URLs with your Vercel URL

.env.local (local dev):
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
`);
