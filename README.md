# Shindig — Modern Event Invites

A beautiful, simple event invitation platform that gets better with every user suggestion.

## Quick Start

```bash
cd ~/shindig
npm install
npm run dev
```

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Vercel Serverless Functions (API routes)
- **Database:** Supabase (free tier: auth + Postgres + realtime)
- **Email:** Resend (free tier: 3k emails/month)
- **SMS:** Twilio (pay-per-use, ~$0.008/text)
- **Hosting:** Vercel (free tier)
- **Payments:** Stripe

## Deployment

Vercel — connects to GitHub repo, auto-deploys on push.

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Vercel hosting | $0 |
| Supabase (DB + auth) | $0 |
| Resend (email) | $0 (under 3k/mo) |
| Twilio (SMS) | ~$20-30 |
| Domain | ~$1/mo |
| **Total** | **~$25/mo** |

