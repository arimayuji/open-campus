import test from "node:test";
import assert from "node:assert/strict";
import { windows, parseSource, openLicense, parseCaptions, condense, validate, uniform, readEpisodes } from "../src/core.js";

test("parseSource accepts known hosts only", () => {
  assert.deepEqual(parseSource("https://www.youtube.com/watch?v=abB3fwfPy14&t=3"), { kind: "youtube", id: "abB3fwfPy14" });
  assert.deepEqual(parseSource("https://youtu.be/abB3fwfPy14"), { kind: "youtube", id: "abB3fwfPy14" });
  assert.deepEqual(parseSource("https://archive.org/details/MIT6_036F18"), { kind: "archive", id: "MIT6_036F18" });
  for (const bad of ["http://youtube.com/watch?v=abB3fwfPy14", "https://evil.example/watch?v=abB3fwfPy14", "https://youtube.com/watch?v=short", "nope", "https://archive.org/details/a/../b", "https://169.254.169.254/"]) assert.equal(parseSource(bad), null, bad);
});

test("openLicense: CC without ND or public domain", () => {
  assert.ok(openLicense("https://creativecommons.org/licenses/by-nc-sa/4.0/"));
  assert.ok(openLicense("http://creativecommons.org/publicdomain/zero/1.0/"));
  assert.ok(!openLicense("https://creativecommons.org/licenses/by-nd/4.0/"));
  assert.ok(!openLicense("https://creativecommons.org/licenses/by-nc-nd/3.0/"));
  assert.ok(!openLicense(undefined)); assert.ok(!openLicense("all rights reserved"));
});

test("parseCaptions handles VTT, SRT, tags and repeats", () => {
  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nhello <c>there</c>\n\n00:00:03.000 --> 00:00:05.000\nhello there\n\n1\n00:01:05,500 --> 00:01:07,000\nnext one";
  assert.deepEqual(parseCaptions(vtt), [{ start: 1, text: "hello there" }, { start: 65, text: "next one" }]);
});

test("condense merges into ~30s lines", () => {
  const c = Array.from({ length: 10 }, (_, i) => ({ start: i * 10, text: "um word" + i }));
  const lines = condense(c).split("\n");
  assert.equal(lines.length, 4); assert.ok(lines[0].startsWith("[0] word0"));
});

const ep = (s, t) => ({ title: "T", lead: "L", plain: "P", start: s, end: t });
test("validate", () => {
  const good = [ep(0, 300), ep(300, 600), ep(600, 900), ep(900, 1200)];
  assert.deepEqual(validate(good, 1200), []);
  assert.ok(validate(good, 1100).some((p) => p.includes("outside")));
  assert.ok(validate([ep(0, 100), ...good.slice(1)], 1200).some((p) => p.includes("length")));
  assert.ok(validate([ep(0, 300), ep(100, 400), ep(400, 700), ep(700, 1000)], 1000).some((p) => p.includes("overlaps")));
  assert.ok(validate(good.slice(0, 3), 1200).length);
  assert.ok(validate([{ ...ep(0, 300), title: "" }, ...good.slice(1)], 1200).length);
  assert.ok(validate([ep(0.5, 300), ...good.slice(1)], 1200).length);
});

test("uniform always passes validation range", () => {
  const eps = uniform(4800); assert.equal(eps.at(-1).end, 4800);
  assert.ok(eps.every((e) => e.end - e.start >= 180 && e.end - e.start <= 720));
});

test("readEpisodes", () => {
  assert.equal(readEpisodes('sure! {"episodes":[1,2]} done').length, 2);
  assert.equal(readEpisodes({ episodes: [1] }).length, 1);
  assert.throws(() => readEpisodes("nothing"));
});

test("validate demands coverage and limits gaps", () => {
  const short = [ep(0, 300), ep(300, 600), ep(600, 900), ep(900, 1200)];
  assert.ok(validate(short, 4800).some((p) => p.includes("cover all")));
  assert.ok(validate([ep(0, 300), ep(1200, 1500), ep(1500, 1800), ep(1800, 2100)], 2100).some((p) => p.includes("gap")));
  assert.deepEqual(validate([ep(1500, 1800), ep(1800, 2100), ep(2100, 2400), ep(2400, 2700)], 2700, { from: 1500, min: 2, max: 8 }), []);
});

test("windows tile the lecture", () => {
  const w = windows(4874); assert.equal(w[0].from, 0); assert.equal(w.at(-1).to, 4874);
  w.forEach((x, i) => { if (i) assert.equal(x.from, w[i - 1].to); assert.ok(x.to - x.from <= 1700); });
  assert.equal(windows(900).length, 1);
});
