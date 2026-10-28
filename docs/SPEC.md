# Open Campus: spec

## What it is
A free, open, English-language study platform that turns openly available AI and cloud material (university lecture playlists, open textbooks, papers, vendor docs) into a course: structured lessons, a sandbox, case studies, adaptive exams and a professor that answers from the sources with citations. It links to the original material and credits it; it does not re-host or claim it.

## Principles
- Source first: every lesson, answer and question points back to a video timestamp, page or URL.
- Links and embeds in public; any downloaded media or transcripts stay local and out of the repo.
- Removal on request: any source can be dropped from the catalogue.
- No certificates, no "diploma", no university names or logos in the product. Completion marks only.
- Community suggests, a human curator decides.

## Who it is for
Anyone who can read: a 60-year-old starting from zero should be able to follow every lesson. Plain language is a requirement, not a bonus.

## Features
0. **Plain-words layer in every lesson**: an everyday example with no jargon and no maths (the umbrella, the thermostat, the spam folder) before the technical steps, then a Plain / Standard / Technical switch that changes the depth of the explanations, the exam wording and the professor's answers. Larger text, high contrast and no timing pressure in exams.
1. **Lesson**: embedded YouTube video, step-by-step breakdown, linked concept terms with a side panel (definition, source, related concepts, "see in graph").
2. **Sandbox**: Python in the browser via Pyodide; Colab links for heavy cases.
3. **Case studies** per track.
4. **Smart exam**: questions tagged by concept, wrong answers mapped to misconceptions, a targeted mini-lesson, a variant question on the same concept, and a delayed retest. Mastery is stored per concept. LLM-written questions are checked against the source before they ship.
5. **Concept graph**: nodes and typed edges, coloured by mastery; prerequisites feed the professor.
6. **Professor (RAG)**: answers with citations and the persona of a teacher; a weekly freshness routine proposes new material and a human approves it.
7. **Tracks**: basic to advanced across AI, cloud and modern agent practice (harness, multi-agent, orchestration, evals).
8. **Suggestions** through GitHub Issues forms.

## Architecture (all Cloudflare)
Workers (API and site), R2 (files), D1 (catalogue, concepts, mastery), Vectorize plus Workers AI (retrieval), Cron Triggers (freshness). Heavy ingestion (yt-dlp, Whisper, chunking, embeddings) runs locally and publishes only metadata and chunks.

RAG schema: `source, type, level, topic, date, locator`. Video is chunked by time, PDFs by chapter and section, with parent-child chunks; search is hybrid with filters; every answer cites a timestamp or page and citations are verified against the retrieved chunks.

## Licensing tiers
- Link and embed only: YouTube lectures, vendor articles (copyright reserved).
- Reuse with attribution: CC-licensed material (for example MIT OCW is CC BY-NC-SA), arXiv per paper licence (metadata is CC0).
- Inspiration only: AGPL platforms (Canvas, Frappe LMS). Code reusable: DeepTutor (Apache 2.0), EduRAG (MIT).

## Milestone 1: one vertical slice
One real lesson end to end.
1. Local script: yt-dlp metadata and captions for one playlist, Whisper where captions are missing, output JSON per video.
2. Chunking and a first RAG index for that playlist.
3. Lesson page fed by that data: video embed, steps and terms generated from the transcript and reviewed by a human.
4. Term panel and concept graph backed by D1.
5. One smart-exam round for that lesson.

Done when: a visitor opens the lesson, plays the video, clicks a term, sees its source timestamp, asks the professor one question and gets a cited answer.

## Open items
- First playlist (candidates: Stanford CS229 or CS224N).
- Cloud-vendor sources (AWS, Google Cloud, Azure).
- Final logo refinement.

## Prototype
`prototype/lesson/` is the static lesson screen (light and dark) built with the palette in `docs/BRAND.md`.
