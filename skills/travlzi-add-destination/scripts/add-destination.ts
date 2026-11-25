#!/usr/bin/env bun
/**
 * Travlzi — add a destination + itinerary page, commit to GitHub, wait for
 * GitHub Pages, and verify the live site. Run with the Kiro-bundled Bun.
 *
 *   bun add-destination.ts --input spec.json            # commit + deploy + verify
 *   bun add-destination.ts --input spec.json --dry-run   # write ./out only, no commit
 *   bun add-destination.ts --input spec.json --no-airport-photo  # skip airport photo search
 *   bun add-destination.ts --help
 *
 * Requires env GITHUB_TOKEN (write access to thejaswis/travlzi) unless --dry-run.
 * Invokes skill-search to find an airport photo and embed it in the itinerary page.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join as pathJoin } from "node:path";

const OWNER = "thejaswis";
const REPO = "travlzi";
const BRANCH = "main";
const SITE_URL = "https://thejaswis.github.io/travlzi";
const TOKEN = process.env.GITHUB_TOKEN?.trim() || "";
const API = "https://api.github.com";

// ---------- args ----------
// Path to the skill-search script (sibling skill)
const SEARCH_SCRIPT = pathJoin(
  import.meta.dir,
  "../../skill-search/scripts/search-airport-photo.ts",
);
const BUN_EXE =
  process.execPath ||
  `${process.env.LOCALAPPDATA || "C:\\Users\\Admin\\AppData\\Local"}\\Kiro-Cli\\bun.exe`;

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const a: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--help" || k === "-h") a.help = true;
    else if (k === "--dry-run") a.dryRun = true;
    else if (k === "--input") a.input = argv[++i];
    else if (k === "--stdin") a.stdin = true;
    else if (k === "--no-airport-photo") a.noAirportPhoto = true;
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Travlzi add-destination
  --input <file>         Path to a JSON spec (see references/workflow.md)
  --dry-run              Generate ./out files without committing
  --stdin                Read spec JSON from stdin instead of --input
  --no-airport-photo     Skip airport photo search (omit the airport section)
Requires env GITHUB_TOKEN with write access to ${OWNER}/${REPO} (unless --dry-run).
Calls skill-search automatically to embed an airport photo in the itinerary page.`);
  process.exit(0);
}

// ---------- spec ----------
let specRaw: string;
if (args.input) specRaw = readFileSync(String(args.input), "utf8");
else if (args.stdin) specRaw = readFileSync(0, "utf8");
else {
  console.error("Pass --input <file> (or --stdin). See --help.");
  process.exit(2);
}
const spec: any = JSON.parse(specRaw);

// ---------- helpers ----------
const slug = slugify(spec.name);
const detailsFile = `${slug}.html`;
function slugify(s: string): string {
  return (
    String(s ?? "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "destination"
  );
}
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function log(...m: unknown[]): void {
  console.log(...m);
}

async function gh(method: string, path: string, body?: any): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "travlzi-skill",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

// ---------- site CSS (shared, copied from the repo's itinerary pages) ----------
const CSS = `:root{--ink:#193a37;--muted:#667b76;--teal:#397b70;--cream:#f6f8f4;--mint:#e4efe7;--line:#e0e8e1;--head:"Manrope",sans-serif;--body:"DM Sans",sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:var(--cream);color:var(--ink);font-family:var(--body);line-height:1.7}a{color:inherit;text-decoration:none}.header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(22px,7vw,100px);background:#fff;border-bottom:1px solid var(--line)}.brand{display:inline-flex;align-items:center}.brand-logo{display:block;width:180px;height:auto;max-height:none;aspect-ratio:auto;object-fit:contain}.back{font-weight:700;color:var(--teal);font-size:.9rem}.hero{min-height:580px;display:flex;align-items:end;position:relative;overflow:hidden;background:#344f46;color:white}.hero img,.shade{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero img{object-position:center 52%}.shade{background:linear-gradient(0deg,rgba(13,37,32,.82),rgba(13,37,32,.05) 85%),linear-gradient(90deg,rgba(13,37,32,.3),transparent)}.hero-content{position:relative;padding:clamp(32px,8vw,100px);max-width:900px}.eyebrow{font-size:.7rem;letter-spacing:.19em;text-transform:uppercase;font-weight:700;color:#d0eadb}.hero h1{font:800 clamp(3rem,7vw,6.3rem)/1.02 var(--head);letter-spacing:-.07em;margin:14px 0}.hero h1 em{font:400 1em Georgia,serif}.hero p:last-child{max-width:650px;color:#f0f7f3;font-size:1.05rem}.quickfacts{display:flex;gap:12px;flex-wrap:wrap;margin-top:25px}.pill{padding:8px 13px;border:1px solid #ffffff70;border-radius:99px;font-size:.78rem;font-weight:600;background:#ffffff12}.intro,.itinerary{max-width:1120px;margin:auto;padding:70px 24px 20px}.intro h2,.section-title{font:700 clamp(2rem,4vw,3.3rem)/1.15 var(--head);letter-spacing:-.06em;margin:0 0 18px}.intro p{max-width:850px;color:var(--muted)}.route-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:28px}.route-card{padding:22px;background:white;border:1px solid var(--line);border-radius:14px}.route-card strong{display:block;font:700 1.1rem var(--head);margin-bottom:7px}.route-card p{font-size:.9rem;margin:0}.itinerary{padding-top:65px;padding-bottom:65px}.day{display:grid;grid-template-columns:95px 1fr;gap:25px;padding:35px 0;border-top:1px solid var(--line)}.day-number{font:800 2rem var(--head);color:var(--teal)}.day h3{font:700 clamp(1.35rem,2.5vw,1.8rem) var(--head);margin:0 0 12px;letter-spacing:-.04em}.day p{color:var(--muted);margin:10px 0}.day ul{padding-left:21px;color:var(--muted)}.day li{margin:7px 0}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0 28px}.gallery img{display:block;width:100%;height:290px;object-fit:contain;object-position:center;border-radius:13px;background:#e4eee9}.food{background:var(--mint);padding:65px 24px}.food-inner{max-width:1120px;margin:auto}.food-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-top:25px}.food-card{padding:21px;background:#ffffffbd;border-radius:12px}.food-card h3{margin:0 0 7px;font:700 1.05rem var(--head)}.food-card p{margin:0;color:var(--muted);font-size:.9rem}.tip{max-width:1120px;margin:65px auto;padding:0 24px}.tip-box{background:var(--ink);color:white;border-radius:16px;padding:clamp(25px,5vw,48px);display:grid;grid-template-columns:70px 1fr;gap:20px}.tip-icon{font-size:2.5rem;color:#c5e7d3}.tip h2{font:700 1.7rem var(--head);margin:0 0 10px}.tip p{color:#d3e6dc;margin:0}.footer{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:25px clamp(22px,7vw,100px);background:white;border-top:1px solid var(--line);font-size:.82rem;color:var(--muted)}.footer a{font-weight:700;color:var(--teal)}@media(max-width:700px){.header{height:68px}.hero{min-height:560px}.route-grid,.food-grid{grid-template-columns:1fr}.day{grid-template-columns:54px 1fr;gap:12px}.day-number{font-size:1.5rem}.tip-box{grid-template-columns:1fr;gap:5px}.intro,.itinerary{padding-top:50px;padding-bottom:50px}}`;

// ---------- airport photo CSS (from skill-search) ----------
const AIRPORT_CSS = `.airport-arrival{max-width:1120px;margin:60px auto 0;padding:0 24px}.airport-arrival .eyebrow{font-size:.7rem;letter-spacing:.19em;text-transform:uppercase;font-weight:700}.airport-figure{margin:18px 0 0}.airport-figure img{width:100%;max-height:480px;object-fit:cover;object-position:center;border-radius:16px;display:block}.airport-figure figcaption{margin-top:8px;font-size:.78rem;color:#667b76;text-align:right}`;

// ---------- HTML generation ----------
function buildHtml(s: any): string {
  const pills = (s.pills || [])
    .map((p: string) => `<span class="pill">${esc(p)}</span>`)
    .join("");
  const routes = (s.intro?.routes || [])
    .map(
      (r: any) =>
        `<article class="route-card"><strong>${esc(r.name)}</strong><p>${esc(r.text)}</p></article>`,
    )
    .join("");
  const days = (s.days || [])
    .map((d: any, i: number) => {
      const bullets = (d.bullets || []).map((b: string) => `<li>${esc(b)}</li>`).join("");
      const imgs = (d.images || [])
        .map(
          (im: any) =>
            `  <img src="${esc(im.src)}" alt="${esc(im.alt || s.name)}" loading="lazy">`,
        )
        .join("\n");
      const gallery = imgs ? `\n<div class="gallery">\n${imgs}\n</div>` : "";
      return `<article class="day"><div class="day-number">${String(i + 1).padStart(2, "0")}</div><div><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p>${bullets ? `<ul>${bullets}</ul>` : ""}${gallery}</div></article>`;
    })
    .join("\n");
  const food = (s.food || [])
    .map((f: any) => `<article class="food-card"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></article>`)
    .join("");
  const tip = s.tip
    ? `<section class="tip"><div class="tip-box"><div class="tip-icon">✦</div><div><h2>${esc(s.tip.title)}</h2><p>${esc(s.tip.text)}</p></div></div></section>`
    : "";
  const heroImg = s.heroImage || s.image;
  const eyebrow = s.eyebrow || `${(s.country || "").toUpperCase()} · A TRAVEL ESCAPE`;
  const heroTitle = s.heroTitle || esc(s.name);
  const heroP = esc(s.heroDescription || s.description || "");
  const foodSection = food
    ? `<section class="food"><div class="food-inner"><div class="eyebrow" style="color:var(--teal)">A TASTE OF ${esc((s.country || "").toUpperCase())}</div><h2 class="section-title">Simple pleasures, local flavours</h2><div class="food-grid">${food}</div></div></section>`
    : "";

  // airport photo section — populated by skill-search if available
  const ap = s.airportPhoto;
  const airportSection = ap
    ? `<!-- airport-photo-section -->
<section class="airport-arrival"><div class="eyebrow" style="color:var(--teal)">ARRIVING IN ${esc((s.name || "").toUpperCase())}</div><figure class="airport-figure"><img src="${esc(ap.src)}" alt="${esc(ap.alt)}" loading="lazy"><figcaption>${esc(ap.credit)}</figcaption></figure></section>
<!-- /airport-photo-section -->`
    : "";

  const extraCss = ap ? AIRPORT_CSS : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#087f8c"><meta name="description" content="${esc(s.description || s.name + " itinerary")}"><title>${esc(s.name)} itinerary - Travlzi</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}${extraCss}</style></head><body>
<header class="header"><a class="brand" href="index.html" aria-label="Travlzi home"><img class="brand-logo" src="images/travlzi-logo.svg?v=3" alt="Travlzi"></a><a class="back" href="index.html#destinations">← All destinations</a></header><main>
<section class="hero"><img src="${esc(heroImg)}" alt="${esc(s.name)}"><div class="shade"></div><div class="hero-content"><div class="eyebrow">${esc(eyebrow)}</div><h1>${heroTitle}</h1><p>${heroP}</p>${pills ? `<div class="quickfacts">${pills}</div>` : ""}</div></section>
${airportSection}
<section class="intro"><div class="eyebrow" style="color:var(--teal)">BEFORE YOU GO</div><h2>${esc(s.intro?.title || "Getting to " + s.name)}</h2><p>${esc(s.intro?.text || "")}</p>${routes ? `<div class="route-grid">${routes}</div>` : ""}</section>
<section class="itinerary"><div class="eyebrow" style="color:var(--teal)">THE PLAN</div><h2 class="section-title">${esc(s.itineraryTitle || s.name + ", day by day.")}</h2>
${days}</section>
${foodSection}
${tip}
</main><footer class="footer"><span>© Travlzi · Thoughtful trips, personal touches.</span><a href="index.html#destinations">Explore more destinations →</a></footer></body></html>`;
}

// ---------- verify ----------
async function verify(name: string, file: string): Promise<{ homeOk: boolean; pageOk: boolean; destPresent: boolean }> {
  const cb = `?cb=${Date.now()}`;
  let homeOk = false,
    pageOk = false,
    destPresent = false;
  for (let i = 0; i < 8; i++) {
    try {
      const r1 = await fetch(`${SITE_URL}/${file}${cb}`, { redirect: "follow" });
      if (r1.ok && (await r1.text()).includes(name)) pageOk = true;
    } catch {}
    try {
      const r2 = await fetch(`${SITE_URL}/content.json${cb}`, { redirect: "follow" });
      if (r2.ok) {
        const t = await r2.text();
        if (t.includes(name)) destPresent = true;
      }
    } catch {}
    try {
      const r3 = await fetch(`${SITE_URL}/${cb}`, { redirect: "follow" });
      if (r3.ok) homeOk = true;
    } catch {}
    if (homeOk && pageOk && destPresent) break;
    await sleep(10000);
  }
  return { homeOk, pageOk, destPresent };
}

// ---------- main ----------
async function main(): Promise<void> {
  if (!args.dryRun && !TOKEN) {
    console.error(
      "GITHUB_TOKEN is required (write access to thejaswis/travlzi). Use --dry-run to preview without committing.",
    );
    process.exit(2);
  }
  log(`Destination: ${spec.name} -> ${detailsFile}`);

  // 1. fetch content.json (works anonymously for a public repo)
  // (airport photo search runs as step 1b, below, after slug is known)
  const cj = await gh("GET", `/repos/${OWNER}/${REPO}/contents/content.json?ref=${BRANCH}`);
  if (cj.status !== 200)
    throw new Error(`content.json fetch failed: ${cj.status} ${typeof cj.json === "string" ? cj.json : JSON.stringify(cj.json)}`);
  const contentJson = JSON.parse(Buffer.from(cj.json.content, "base64").toString("utf8"));
  const shaContent = cj.json.sha;

  // 1b. airport photo — invoke skill-search as a subprocess
  if (!args.noAirportPhoto && !spec.airportPhoto) {
    log("Searching for airport photo (skill-search) …");
    try {
      const result = Bun.spawnSync(
        [BUN_EXE, SEARCH_SCRIPT, "--destination", spec.name, "--slug", slug, "--json"],
        { env: { ...process.env }, stdout: "pipe", stderr: "pipe" },
      );
      const stdout = result.stdout?.toString().trim();
      if (result.exitCode === 0 && stdout && stdout !== "null") {
        const photo = JSON.parse(stdout);
        spec.airportPhoto = photo;
        log(`  airport photo found: ${photo.src}`);
      } else {
        const stderr = result.stderr?.toString().trim();
        log(`  airport photo not found (skill-search exited ${result.exitCode}${stderr ? ": " + stderr.slice(0, 120) : ""}); continuing without it`);
      }
    } catch (e: any) {
      log(`  airport photo search failed: ${e?.message}; continuing without it`);
    }
  }

  // 2. build destination entry (dedupe by name)
  const destEntry: any = {
    name: spec.name,
    country: spec.country || "",
    tag: spec.tag || "",
    description: spec.description || "",
    image: spec.image || "",
    detailsUrl: detailsFile,
  };
  const existing = (contentJson.destinations || []).find((d: any) => d.name === spec.name);
  if (existing) {
    console.warn(`Note: a destination named "${spec.name}" already exists; updating its entry in place.`);
    Object.assign(existing, destEntry);
  } else {
    contentJson.destinations = [...(contentJson.destinations || []), destEntry];
  }
  const newContentJson = JSON.stringify(contentJson, null, 2) + "\n";
  const html = buildHtml(spec);

  // 3. dry-run -> write ./out
  if (args.dryRun) {
    mkdirSync("./out", { recursive: true });
    writeFileSync("./out/content.json", newContentJson);
    writeFileSync(`./out/${detailsFile}`, html);
    log(`[dry-run] wrote ./out/content.json and ./out/${detailsFile}`);
    log(`[dry-run] destination entry: ${JSON.stringify(destEntry)}`);
    log(`[dry-run] html bytes: ${html.length}`);
    return;
  }

  // 4. commit content.json
  log("Committing content.json …");
  const putC = await gh("PUT", `/repos/${OWNER}/${REPO}/contents/content.json`, {
    message: `Add destination: ${spec.name}`,
    content: b64(newContentJson),
    sha: shaContent,
    branch: BRANCH,
  });
  if (putC.status >= 300)
    throw new Error(`content.json commit failed: ${putC.status} ${JSON.stringify(putC.json)}`);
  const commitContent = putC.json?.commit?.sha;
  log(`  committed (${commitContent?.slice(0, 7)})`);

  // 5. commit itinerary page (update if it already exists)
  log(`Committing ${detailsFile} …`);
  const existHtml = await gh("GET", `/repos/${OWNER}/${REPO}/contents/${detailsFile}?ref=${BRANCH}`);
  const htmlBody: any = {
    message: `Add itinerary page: ${spec.name}`,
    content: b64(html),
    branch: BRANCH,
  };
  if (existHtml.status === 200) htmlBody.sha = existHtml.json.sha;
  const putH = await gh("PUT", `/repos/${OWNER}/${REPO}/contents/${detailsFile}`, htmlBody);
  if (putH.status >= 300)
    throw new Error(`${detailsFile} commit failed: ${putH.status} ${JSON.stringify(putH.json)}`);
  const commitHtml = putH.json?.commit?.sha;
  log(`  committed (${commitHtml?.slice(0, 7)})`);

  // 6. wait for GitHub Pages deployment
  log("Waiting for GitHub Pages deployment …");
  for (let i = 0; i < 40; i++) {
    await sleep(15000);
    const b = await gh("GET", `/repos/${OWNER}/${REPO}/pages/builds/latest`);
    if (b.status === 200) {
      const st = b.json?.status;
      log(`  pages build status: ${st}`);
      if (st === "built") break;
      if (st === "errored" || st === "failed") {
        console.warn("  pages build reported an error; continuing to verify anyway.");
        break;
      }
    } else if (b.status === 404) {
      log("  pages builds API unavailable (404); skipping build poll, will verify content directly.");
      break;
    } else {
      log(`  pages build poll returned ${b.status}`);
    }
  }

  // 7. verify
  log("Verifying live site …");
  const v = await verify(spec.name, detailsFile);
  log("\n=== RESULT ===");
  log(`Homepage:            ${SITE_URL}/`);
  log(`Itinerary page:      ${SITE_URL}/${detailsFile}`);
  log(`Commit (content.json): https://github.com/${OWNER}/${REPO}/commit/${commitContent}`);
  log(`Commit (${detailsFile.padEnd(14)}): https://github.com/${OWNER}/${REPO}/commit/${commitHtml}`);
  log(`Homepage loads:               ${v.homeOk}`);
  log(`Itinerary page loads:         ${v.pageOk}`);
  log(`New destination live:        ${v.destPresent}`);
  if (v.homeOk && v.pageOk && v.destPresent) log("\n✅ Verified: destination added and live.");
  else log("\n⚠ Verification incomplete — Pages may still be propagating; re-check in a minute.");
}

main().catch((e) => {
  console.error("FAILED:", e?.stack || e);
  process.exit(1);
});
