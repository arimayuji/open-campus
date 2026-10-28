import { Container, getContainer } from "@cloudflare/containers";

// One small container running yt-dlp. It sleeps when idle, so it costs nothing between lessons.
export class YtDlp extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
}

/** Ask the container for a video's licence, length, embed flag and captions (WebVTT). */
export async function ytInfo(env, id, lang = "en") {
  const res = await getContainer(env.YTDLP, "main").fetch(`http://yt/info?id=${encodeURIComponent(id)}&lang=${lang}`);
  const j = await res.json();
  if (!res.ok) throw new Error("yt-dlp: " + (j.error || res.status));
  return j;
}
