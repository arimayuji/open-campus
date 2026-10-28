// Cloud ingest: a link in, a draft lesson out, all on Cloudflare.
//   source -> (CC archive video) Stream copy -> Stream captions -> episode cuts (Workers AI) -> D1
// YouTube: yt-dlp runs in a Cloudflare Container and returns licence, length, embed flag and captions.
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { ytInfo } from "./ytdlp.js";
import { parseSource, openLicense, parseCaptions, condense, prompt, validate, uniform, readEpisodes } from "./core.js";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const UA = { "User-Agent": "OpenCampus/1.0 (+https://opencampus.dev)" };
const RETRY = { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" }, timeout: "5 minutes" };

const stream = (env, path, init = {}) =>
  fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.STREAM_TOKEN}`, "Content-Type": "application/json", ...init.headers },
  });

async function setJob(env, id, patch) {
  const keys = Object.keys(patch);
  await env.DB.prepare(`UPDATE jobs SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => patch[k]), id).run();
}

async function readSource(env, src) {
  if (src.kind === "youtube") {
    // yt-dlp runs in a Cloudflare Container: from there YouTube answers, unlike a plain Worker fetch.
    const j = await ytInfo(env, src.id);
    const cc = /creative commons/i.test(j.license || "");
    return {
      ...src, url: `https://www.youtube.com/watch?v=${src.id}`, title: j.title || src.id, creator: j.channel || null,
      license: j.license || null, hosted: false, embeddable: j.embeddable !== false, duration: Math.round(j.duration) || null,
      creativeCommons: cc, vtt: j.vtt || null, note: j.note || null,
    };
  }
  const r = await fetch(`https://archive.org/metadata/${src.id}`, { headers: UA });
  if (!r.ok) throw new Error(`archive.org answered ${r.status}`);
  const j = await r.json();
  const lic = j.metadata?.licenseurl;
  if (!j.metadata) throw new NonRetryableError("Internet Archive item not found.");
  if (!openLicense(lic)) throw new NonRetryableError(`Not hosted: licence is ${lic || "not stated"}. Only Creative Commons without NoDerivatives, or public domain, can be hosted.`);
  const mp4 = (j.files || []).filter((f) => /\.mp4$/i.test(f.name) && !/\.ia\.mp4$/i.test(f.name) && f.source !== "derivative").concat((j.files || []).filter((f) => /\.mp4$/i.test(f.name)))[0];
  if (!mp4) throw new NonRetryableError("No MP4 file in this item.");
  const dur = Math.round(Number(mp4.length) || 0);
  if (!dur) throw new NonRetryableError("Could not read the video length.");
  return {
    ...src, url: `https://archive.org/details/${src.id}`, title: [].concat(j.metadata.title)[0], creator: [].concat(j.metadata.creator || [])[0] || null,
    license: lic, hosted: true, embeddable: true, duration: dur,
    file: `https://archive.org/download/${src.id}/${encodeURIComponent(mp4.name)}`, size: Number(mp4.size) || 0,
  };
}

export class IngestLesson extends WorkflowEntrypoint {
  async run(event, step) {
    const { jobId, url, topic, level, transcript } = event.payload;
    const env = this.env;
    try {
      await step.do("start", () => setJob(env, jobId, { state: "running", step: "reading the source" }));
      const parsed = parseSource(url);
      if (!parsed) throw new NonRetryableError("Unsupported link.");
      const src = await step.do("source", RETRY, async () => {
        const { vtt, ...meta } = await readSource(env, parsed);
        return { ...meta, ytChunks: vtt ? parseCaptions(vtt) : null };
      });

      let chunks = src.ytChunks?.length ? src.ytChunks : null, uid = null;
      if (transcript) {
        chunks = await step.do("supplied-transcript", () => {
          let c;
          try { const j = JSON.parse(transcript); c = (j.chunks || j).map((x) => ({ start: Math.floor(Number(x.start)), text: String(x.text) })); }
          catch { c = parseCaptions(transcript); }
          if (!c.length) throw new NonRetryableError("Could not read any captions from the supplied transcript.");
          return c;
        });
      }

      if (src.hosted) {
        await step.do("stream-copy", RETRY, async () => {
          await setJob(env, jobId, { step: "copying the video to Cloudflare Stream" });
          const r = await stream(env, "/copy", {
            method: "POST",
            body: JSON.stringify({
              url: src.file, meta: { name: src.title, source: src.url, license: src.license, creator: src.creator || "" },
              allowedOrigins: ["opencampus.dev", "www.opencampus.dev"], requireSignedURLs: false,
            }),
          });
          const j = await r.json();
          if (!j.success) throw new Error("Stream copy failed: " + JSON.stringify(j.errors).slice(0, 300));
          return j.result.uid;
        }).then((u) => { uid = u; });

        // Wait for Stream to transcode (up to ~40 minutes).
        let ready = false;
        for (let i = 0; i < 80 && !ready; i++) {
          await step.sleep(`wait-video-${i}`, "30 seconds");
          ready = await step.do(`check-video-${i}`, async () => {
            const j = await (await stream(env, `/${uid}`)).json();
            const st = j.result?.status;
            if (st?.state === "error") throw new NonRetryableError("Stream could not process the video: " + (st.errorReasonText || st.errorReasonCode));
            return !!j.result?.readyToStream;
          });
        }
        if (!ready) throw new NonRetryableError("Stream took too long to process the video.");

        if (!chunks) {
          await step.do("captions-start", RETRY, async () => {
            await setJob(env, jobId, { step: "writing captions with Stream" });
            const r = await stream(env, `/${uid}/captions/en/generate`, { method: "POST" });
            const j = await r.json();
            if (!j.success && !JSON.stringify(j.errors).includes("already")) throw new Error("captions: " + JSON.stringify(j.errors).slice(0, 300));
          });
          let done = false;
          for (let i = 0; i < 60 && !done; i++) {
            await step.sleep(`wait-captions-${i}`, "30 seconds");
            done = await step.do(`check-captions-${i}`, async () => {
              const j = await (await stream(env, `/${uid}/captions`)).json();
              const c = (j.result || []).find((x) => x.language === "en");
              if (c?.status === "error") throw new NonRetryableError("Stream could not write captions for this video.");
              return c?.status === "ready" || (c && c.status === undefined && c.generated);
            });
          }
          if (!done) throw new NonRetryableError("Captions took too long.");
          chunks = await step.do("captions-read", RETRY, async () => {
            const r = await stream(env, `/${uid}/captions/en/vtt`);
            const c = parseCaptions(await r.text());
            if (!c.length) throw new Error("empty captions");
            return c;
          });
        }
      }

      if (!chunks) {
        await step.do("needs-transcript", () => setJob(env, jobId, { state: "needs_transcript", step: "waiting for a transcript",
          error: ("This video has no captions we could read. Submit the link again with a transcript attached (VTT, SRT or JSON). " + (src.note || "")).slice(0, 600) }));
        return { needsTranscript: true };
      }

      const duration = src.duration || chunks[chunks.length - 1].start + 30;
      await step.do("store-transcript", async () => {
        await env.MEDIA.put(`transcripts/${src.id}.json`, JSON.stringify({ source: src.url, license: src.license, chunks }), { httpMetadata: { contentType: "application/json" } });
        await setJob(env, jobId, { step: "transcript ready" });
        return true; // a step must return plain data, not the R2 object
      });

      const cuts = await step.do("cuts", { retries: { limit: 1, delay: "5 seconds" }, timeout: "5 minutes" }, async () => {
        await setJob(env, jobId, { step: "cutting the lecture into episodes" });
        const base = prompt(duration, condense(chunks));
        let problems = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          const p = problems.length ? base + "\n\nYour previous answer had these problems, fix them:\n- " + problems.join("\n- ") : base;
          try {
            const out = await env.AI.run(MODEL, { messages: [{ role: "user", content: p }], max_tokens: 4096, temperature: 0.2 });
            const eps = readEpisodes(out.response);
            problems = validate(eps, duration);
            if (!problems.length) return { episodes: eps, review: false };
          } catch (e) { problems = ["could not read your answer as JSON: " + String(e).slice(0, 100)]; }
        }
        return { episodes: uniform(duration), review: true };
      });

      await step.do("save", async () => {
        await env.DB.prepare(
          `INSERT INTO lessons (id, kind, source_url, title, creator, license, hosted, embeddable, stream_uid, topic, level, duration, needs_review, episodes)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
           ON CONFLICT(id) DO UPDATE SET title=?4, creator=?5, license=?6, hosted=?7, embeddable=?8, stream_uid=?9, topic=?10, level=?11,
             duration=?12, needs_review=?13, episodes=?14, status='draft', published_at=NULL`)
          .bind(src.id, src.kind, src.url, src.title, src.creator, src.license, src.hosted ? 1 : 0, src.embeddable ? 1 : 0, uid, topic || "", level || "",
            duration, cuts.review ? 1 : 0, JSON.stringify(cuts.episodes)).run();
        await setJob(env, jobId, { state: "done", step: "draft saved", lesson_id: src.id, error: null });
      });
      return { lesson: src.id };
    } catch (e) {
      await setJob(env, jobId, { state: "error", step: "failed", error: String(e?.message || e).slice(0, 400) });
      throw e;
    }
  }
}
