# Adding a lesson, all on Cloudflare

Nothing runs on a contributor's computer. A link goes in, a draft lesson comes out, a human publishes it.

```
POST /api/submit  (admin token)
        |
   Workflow "ingest-lesson"  (durable steps, automatic retries)
        |
   source ----- YouTube: yt-dlp in a Cloudflare Container (licence, length, embed flag, captions).
        |        Internet Archive: metadata API. Hosted only if the licence is Creative Commons without
        |        NoDerivatives, or public domain. Anything else is refused.
        |
   transcript -- supplied by a person (VTT, SRT or JSON), or
        |        for hosted video: Stream copies the file by URL, compresses it, and writes English captions.
        |
   cuts -------- Workers AI (Llama 3.3 70B) proposes 3 to 12 minute episodes with a plain-words summary.
        |        Every cut is validated (length, order, overlap, inside the video); two retries with the
        |        problems fed back; then equal parts flagged needs_review.
        |
   D1 ---------- lesson saved as `draft`. R2 keeps the private transcript.
        |
POST /api/lessons/:id/publish  (admin token)   <- the human curation gate
GET  /api/lessons, /api/lessons/:id             <- public, published only
GET  /api/jobs/:id                              <- progress
```

## YouTube
A plain Worker `fetch` to YouTube gets a bot check (HTTP 429, probed). yt-dlp running inside a Cloudflare Container does not: the `YtDlp` container (`container/`) returns title, channel, licence, length, the embed flag and the captions as WebVTT. Link in, captions out, nothing on a contributor's computer. The container sleeps when idle.
If a video has no captions the job stops at `needs_transcript` and the same link can be submitted again with a transcript attached.
yt-dlp breaks when YouTube changes: rebuild the image regularly (a weekly scheduled deploy is the plan).

## Needs
- Docker on the machine that runs `wrangler deploy` (it builds the container image).
- Secrets: `ADMIN_TOKEN` (submit and publish), `STREAM_TOKEN` (a token limited to Stream read and write).
- Cloudflare Stream enabled (paid, about $5 per 1,000 minutes stored). Only the hosted Creative Commons path needs it.
- D1 `open-campus`, Workers AI, Workflows: bindings in `wrangler.jsonc`.

## Tests
`node --test test/core.test.mjs` covers link parsing, the licence gate, caption parsing and cut validation.

## Accounts and saved progress
Sign in with GitHub (`/api/auth/github`, callback `/api/auth/callback`). The Worker reads the public profile once and keeps no GitHub token. Sessions are a random cookie (`oc_session`, HttpOnly, Secure, SameSite=Lax, 30 days); D1 stores only its SHA-256. Progress is per user and lecture (`/api/progress/:lesson`, GET and PUT) and is merged, never overwritten: episodes seen are united, play counts take the maximum, a right answer beats a wrong one. The browser keeps working signed out and uploads what it has on first sign in.

Setup: create a GitHub OAuth App with callback `https://opencampus.dev/api/auth/callback`, then `wrangler secret put GITHUB_CLIENT_ID` and `wrangler secret put GITHUB_CLIENT_SECRET`.
