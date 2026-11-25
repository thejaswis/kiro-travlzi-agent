#!/usr/bin/env bun
/**
 * skill-search — find an airport/arrival photo for a Travlzi destination
 * and (optionally) patch it into the destination's live itinerary page.
 *
 *   search-airport-photo.ts --destination "Lisbon" --dry-run
 *   search-airport-photo.ts --destination "Lisbon" --patch
 *   search-airport-photo.ts --destination "Lisbon" --patch --force
 *   search-airport-photo.ts --destination "Lisbon" --json
 *
 * --json     : print ONLY the result JSON on stdout (for subprocess use)
 * --dry-run  : no commit (search still runs; patch preview saved to ./out)
 * --patch    : fetch <slug>.html from GitHub, insert section, commit
 * --force    : replace an existing airport section instead of skipping
 */
import { writeFileSync, mkdirSync } from "node:fs";

const OWNER = "thejaswis";
const REPO = "travlzi";
const BRANCH = "main";
const SITE_URL = "https://thejaswis.github.io/travlzi";
const TOKEN = process.env.GITHUB_TOKEN?.trim() || "";
const API = "https://api.github.com";

// ---------- args ----------
function parseArgs(argv: string[]): Record<string, string | boolean> {
  const a: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--help" || k === "-h") a.help = true;
    else if (k === "--dry-run") a.dryRun = true;
    else if (k === "--patch") a.patch = true;
    else if (k === "--force") a.force = true;
    else if (k === "--json") a.json = true;
    else if (k === "--destination") a.destination = argv[++i];
    else if (k === "--slug") a.slug = argv[++i];
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`skill-search — airport photo finder for Travlzi
  --destination <name>   Destination name (required)
  --slug <slug>         Page slug (default: destination lowercased)
  --json                Print only result JSON on stdout
  --dry-run             No commit; patch preview written to ./out
  --patch               Patch <slug>.html on GitHub (needs GITHUB_TOKEN)
  --force               Replace existing airport section
GITHUB_TOKEN (write access to ${OWNER}/${REPO}) is required for --patch without --dry-run.`);
  process.exit(0);
}

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

const destination = String(args.destination || "");
if (!destination) {
  console.error("--destination <name> is required. See --help.");
  process.exit(2);
}
const slug = String(args.slug || slugify(destination));
const detailsFile = `${slug}.html`;
const humanMode = !args.json; // human-readable logs go to stderr when --json

function log(...m: unknown[]): void {
  if (humanMode) console.log(...m);
  else console.error(...m); // keep stdout clean for JSON
}

async function gh(method: string, path: string, body?: any): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "travlzi-skill-search",
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

// ---------- photo search ----------
type PhotoResult = {
  src: string;
  alt: string;
  credit: string;
  unsplashUrl: string;
  query: string;
  fallback: boolean;
};

async function searchUnsplash(query: string): Promise<any[] | null> {
  try {
    const res = await fetch(
      `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=5`,
      { headers: { "User-Agent": "travlzi-skill-search" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.results) ? data.results : null;
  } catch {
    return null;
  }
}

function pickBest(results: any[], query: string): PhotoResult {
  let best: { score: number; r: any } | null = null;
  results.forEach((r: any, i: number) => {
    let score = Math.max(0, 3 - i); // relevance by position
    const w = r?.width || 0;
    const h = r?.height || 0;
    if (w >= h) score += 2; // landscape preferred
    if (w >= 1600) score += 1;
    if (!best || score > best.score) best = { score, r };
  });
  const r = best!.r;
  const id = r.id;
  const photographer = r?.user?.name || "Unsplash contributor";
  const alt = r?.alt_description || r?.description || `${destination} — ${query}`;
  return {
    src: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=85`,
    alt: alt.slice(0, 180),
    credit: `Photo by ${photographer} on Unsplash`,
    unsplashUrl: r?.links?.html || `https://unsplash.com/photos/${id}`,
    query,
    fallback: false,
  };
}

async function fallbackPhoto(query: string): Promise<PhotoResult> {
  // source.unsplash.com redirects to a matching photo
  const res = await fetch(`https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`, {
    redirect: "follow",
  });
  const src = res.url || `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`;
  return {
    src: `${src}${src.includes("?") ? "&" : "?"}auto=format&fit=crop&w=1200&q=85`,
    alt: `${destination} — ${query}`,
    credit: "Photo via Unsplash",
    unsplashUrl: "https://unsplash.com",
    query,
    fallback: true,
  };
}

async function findAirportPhoto(): Promise<PhotoResult | null> {
  const queries = [
    `${destination} airport`,
    `${destination} arrival terminal`,
    `${destination} skyline`,
  ];
  for (const q of queries) {
    log(`searching: ${q}`);
    const results = await searchUnsplash(q);
    if (results && results.length > 0) {
      const photo = pickBest(results, q);
      log(`  found ${results.length} result(s); picked ${photo.unsplashUrl}`);
      return photo;
    }
    log("  no results");
  }
  log("search API exhausted; trying source.unsplash.com fallback");
  try {
    return await fallbackPhoto(queries[0]);
  } catch {
    return null;
  }
}

// ---------- HTML patch ----------
const AIRPORT_CSS = `.airport-arrival{max-width:1120px;margin:60px auto 0;padding:0 24px}.airport-arrival .eyebrow{font-size:.7rem;letter-spacing:.19em;text-transform:uppercase;font-weight:700}.airport-figure{margin:18px 0 0}.airport-figure img{width:100%;max-height:480px;object-fit:cover;object-position:center;border-radius:16px;display:block}.airport-figure figcaption{margin-top:8px;font-size:.78rem;color:#667b76;text-align:right}`;

function buildAirportSection(p: PhotoResult): string {
  return `<!-- airport-photo-section -->
<section class="airport-arrival"><div class="eyebrow" style="color:var(--teal)">ARRIVING IN ${esc(destination.toUpperCase())}</div><figure class="airport-figure"><img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy"><figcaption>${esc(p.credit)}</figcaption></figure></section>
<!-- /airport-photo-section -->`;
}

function injectAirportSection(html: string, p: PhotoResult, force: boolean): string {
  const marker = "<!-- airport-photo-section -->";
  const hasExisting = html.includes(marker);
  if (hasExisting && !force) {
    log("[skip] airport section already present (use --force to replace)");
    return html;
  }
  if (hasExisting && force) {
    // replace existing block (marker to closing marker)
    const re = /<!-- airport-photo-section -->[\s\S]*?<!-- \/airport-photo-section -->\s*/;
    html = html.replace(re, buildAirportSection(p) + "\n");
    log("[replace] overwrote existing airport section");
    return html;
  }
  const anchor = `<section class="intro">`;
  if (html.includes(anchor)) {
    html = html.replace(anchor, `${buildAirportSection(p)}\n${anchor}`);
    log("[insert] airport section added before intro");
  } else {
    // no intro anchor — insert before </main>
    html = html.replace("</main>", `${buildAirportSection(p)}\n</main>`);
    log("[insert] airport section added before </main> (intro anchor not found)");
  }
  // append CSS before closing style tag
  if (!html.includes(".airport-arrival{")) {
    html = html.replace("</style>", `${AIRPORT_CSS}</style>`);
  }
  return html;
}

// ---------- main ----------
async function main(): Promise<void> {
  if (args.patch && !args.dryRun && !TOKEN) {
    console.error("GITHUB_TOKEN is required for --patch. Use --dry-run to preview.");
    process.exit(2);
  }

  const photo = await findAirportPhoto();
  if (!photo) {
    if (args.json) {
      process.stdout.write("null\n");
    }
    console.error("No airport photo found for any query.");
    process.exit(3);
  }

  // --json (or no --patch): print result and exit
  if (args.json || !args.patch) {
    const out = JSON.stringify(photo, null, 2);
    if (args.json) process.stdout.write(JSON.stringify(photo) + "\n");
    else {
      log("\n=== RESULT ===");
      log(`Destination:    ${destination}`);
      log(`Query:          ${photo.query}`);
      log(`Photo URL:      ${photo.src}`);
      log(`Alt:            ${photo.alt}`);
      log(`Credit:         ${photo.credit}`);
      log(`Unsplash page:  ${photo.unsplashUrl}`);
      log(`Fallback:       ${photo.fallback}`);
    }
    if (!args.json) process.stdout.write(out + "\n");
    return;
  }

  // --patch: fetch live page, inject, commit
  log(`Fetching ${detailsFile} from GitHub …`);
  const page = await gh("GET", `/repos/${OWNER}/${REPO}/contents/${detailsFile}?ref=${BRANCH}`);
  if (page.status !== 200) {
    throw new Error(
      `${detailsFile} fetch failed: ${page.status} — does the itinerary page exist? Run travlzi-add-destination first.`,
    );
  }
  const pageSha = page.json.sha;
  let html = Buffer.from(page.json.content, "base64").toString("utf8");

  const patched = injectAirportSection(html, photo, Boolean(args.force));

  if (patched === html) {
    log("Nothing to commit (section already present).");
    return;
  }

  if (args.dryRun) {
    mkdirSync("./out", { recursive: true });
    writeFileSync(`./out/${detailsFile}`, patched);
    log(`[dry-run] wrote ./out/${detailsFile}`);
    return;
  }

  log(`Committing ${detailsFile} …`);
  const put = await gh("PUT", `/repos/${OWNER}/${REPO}/contents/${detailsFile}`, {
    message: `Add airport photo section: ${destination}`,
    content: b64(patched),
    sha: pageSha,
    branch: BRANCH,
  });
  if (put.status >= 300) throw new Error(`${detailsFile} commit failed: ${put.status} ${JSON.stringify(put.json)}`);
  const commitSha = put.json?.commit?.sha;
  log(`  committed (${commitSha?.slice(0, 7)})`);

  // wait briefly for pages, then verify
  log("Waiting for GitHub Pages …");
  for (let i = 0; i < 20; i++) {
    await sleep(15000);
    const b = await gh("GET", `/repos/${OWNER}/${REPO}/pages/builds/latest`);
    if (b.status === 200 && b.json?.status === "built") break;
    if (b.status === 200 && (b.json?.status === "errored" || b.json?.status === "failed")) {
      log("  pages build errored; verifying anyway");
      break;
    }
    if (b.status === 404) break;
  }

  log("Verifying live page …");
  let liveOk = false;
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(`${SITE_URL}/${detailsFile}?cb=${Date.now()}`);
      if (r.ok && (await r.text()).includes("airport-photo-section")) liveOk = true;
    } catch {}
    if (liveOk) break;
    await sleep(10000);
  }

  log("\n=== RESULT ===");
  log(`Photo URL:         ${photo.src}`);
  log(`Live page:         ${SITE_URL}/${detailsFile}`);
  log(`Commit:            https://github.com/${OWNER}/${REPO}/commit/${commitSha}`);
  log(`Airport section:   ${liveOk ? "live ✅" : "not yet visible ⚠ (may be propagating)"}`);
  if (!args.json) process.stdout.write(JSON.stringify(photo, null, 2) + "\n");
}

main().catch((e) => {
  if (args.json) process.stdout.write("null\n");
  console.error("FAILED:", e?.stack || e);
  process.exit(1);
});
