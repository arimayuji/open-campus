# Hosting open-licence video

Only videos under a Creative Commons licence are copied and hosted. Everything else is embedded or linked, never copied. The gate is in code (`pipeline/fetch_video.py`) and has no override flag.

## Flow
1. `python pipeline/fetch_video.py <url> --check` shows title, channel and licence, and says whether the video is allowed.
2. `python pipeline/fetch_video.py <url> --upload` downloads at most 720p, compresses to H.264 and AAC with the fast-start flag (a 1080p test clip went from 21.8 MB to 1.6 MB), uploads it to the private R2 bucket `open-campus-media`, and writes the credit to `content/credits/<id>.json`.
3. In the lesson, set `data-media="/media/<id>.mp4"` on the video slot and show the credit under the player. Episodes seek with the clip start and stop at the clip end.
4. `python pipeline/fetch_video.py --remove <id>` deletes the object and the credit.

## Serving and security
- The bucket is private. Only the Worker (`src/worker.js`) reads it, at `/media/<11-character id>.mp4`.
- GET and HEAD only; anything else returns 405. Any path that is not exactly that pattern returns 404. Byte ranges work, so seeking is fast; bad ranges return 416.
- Static pages carry `nosniff`, a referrer policy, a permissions policy and `SAMEORIGIN` framing through `prototype/_headers`.
- The Cloudflare token lives only in the environment, never in the repo.

## Licence terms to respect
Creative Commons BY needs credit. BY-NC-SA also forbids commercial use and requires sharing adaptations under the same terms, so a lesson built on such a video should say so.
