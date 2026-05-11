This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill in values. Notable keys:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (diagnosis, contractors, vetting, work order, etc.) |
| `ELEVENLABS_API_KEY` | Optional; generate spoken quote-request scripts. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Optional; place outbound quote-request call (default target is `+15109609841`). |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Optional; send quote-request email (default recipient is `ethan.chkrn@gmail.com`). |
| `LANDLORD_OVERRIDE_PHONE` | Override outbound quote call target (defaults to `+15109609841`). |
| `QUOTE_NOTIFY_EMAIL` | Override quote email recipient (defaults to `ethan.chkrn@gmail.com`). |
| `APP_URL` | **Twilio webhooks:** must be a **public `https://` URL** (e.g. Vercel deployment or `ngrok http 3000`) for speech capture (`/api/twilio/voice` + `/api/twilio/gather`). If unset or only `http://localhost`, calls still work using **inline TwiML** (you hear the quote request, but Twilio cannot post speech back without a reachable URL). |
| `NEXT_PUBLIC_APP_URL` | Fallback for `APP_URL`; also used so background pipeline `fetch` hits the same host on Vercel. |
| `WORKFLOW_INTERNAL_FETCH_TIMEOUT_MS` | Optional; max wait per workflow internal `fetch` to `/api/vet`, `/api/work-order`, `/api/notify` (default **120000**). Raise if you see `AbortError: This operation was aborted` while vetting is still running. |

If Twilio/Resend credentials are missing, the notify step runs in mock mode and still persists quote-request status to the request row so the dashboard flow remains testable.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
