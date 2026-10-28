# Adding a lesson, all on Cloudflare

Nothing runs on a contributor's computer. A link goes in, a draft lesson comes out, a human publishes it.

```
POST /api/submit  (admin token)
        |
   Workflow "ingest-lesson"  (durable steps, automatic retries)
        |
   source ----- YouTube: oEmbed only (title, author, embeddable). No licence data, so embed or link only.
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

## Why YouTube is metadata-only
YouTube answers requests from Cloudflare's network with a bot check (HTTP 429 on the watch page, probed from a Worker). We do not work around it. oEmbed works, so title, author and whether the owner allows embedding are known. The transcript for a YouTube lesson is attached by the person who submits it.

## Needs
- Secrets: `ADMIN_TOKEN` (submit and publish), `STREAM_TOKEN` (a token limited to Stream read and write).
- Cloudflare Stream enabled (paid, about $5 per 1,000 minutes stored). Only the hosted Creative Commons path needs it.
- D1 `open-campus`, Workers AI, Workflows: bindings in `wrangler.jsonc`.

## Tests
`node --test test/core.test.mjs` covers link parsing, the licence gate, caption parsing and cut validation.
