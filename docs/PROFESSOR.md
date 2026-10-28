# Professor: design

The professor answers questions about a lesson using only the catalogue, and every claim points back to a moment or page that can be checked.

## What exists today
`prototype/professor/` is a browser-only retrieval prototype. You load the transcript JSON made by `pipeline/ingest.py`; it ranks passages with BM25 (stop words and spoken fillers removed) and shows the best three, unchanged, with a link to the exact moment in the video. If nothing matches it says so instead of guessing. Tested on CS229 Lecture 3: "plus sign in the update" lands at 59:46, "sigmoid" at 47:26, "one more example added to a line" at 44:47, and an off-topic question returns no match.

It does not write answers yet. Showing only the lecture's own words is the safest first version.

## Production design (Cloudflare)
1. **Index**: chunks from the ingestion script are embedded with Workers AI and stored in Vectorize, with the metadata schema `source, type, level, topic, date, locator`. Run offline; only chunks and metadata are published, never media.
2. **Retrieve**: hybrid search (vector plus BM25) with filters on lesson, level and topic. Return the top passages with their locators.
3. **Answer**: a Worker calls an LLM with the passages and the contract below.
4. **Verify**: before showing the answer, check that every cited locator was in the retrieved set and that each quoted span appears in its passage. If a check fails, fall back to showing the passages alone.
5. **Level**: the Plain / Standard / Technical setting changes only the wording of step 3.

## Prompt contract
- You are a patient teacher. Answer only from the passages provided; if they do not cover the question, say so and name the closest lesson.
- Every sentence that states a fact ends with its citation: video id and timestamp, or document and page.
- Plain level: short sentences, no jargon, one everyday example, then the precise idea.
- Never invent a source, a quote, a number or a timestamp.
- If the passages disagree or are out of date, say that and show both with their dates.

## Open questions
- Which model to use per level (cost vs quality); the verification step makes a small model acceptable.
- Whether to show the retrieved passages under every generated answer by default (recommended).
