# SOP — Add a Travlzi Destination and Publish It

## Purpose
Add a new travel destination to `thejaswis/travlzi` — a homepage card plus a full itinerary page with images — commit it, wait for the GitHub Pages deploy, verify the live site, and report a clear pass/fail with URLs.

## Scope
- **Applies to:** the `travlzi-add-destination` skill.
- **Out of scope:** removing destinations, editing `script.js` `fallbackContent`, other repos.

## Prerequisites
1. `GITHUB_TOKEN` env var with write access to `thejaswis/travlzi`:
   - Classic PAT → `repo` scope, **or**
   - Fine-grained PAT → `Contents: Read and write` + `Pages: Read`.
   - Without a token, only `--dry-run` works (no commit).
2. The `travlzi-github` MCP server connected (configured in `~/.kiro/settings/mcp.json`).
3. Kiro-bundled Bun at `C:\Users\Admin\AppData\Local\Kiro-Cli\bun.exe`.

## Inputs
A JSON spec. **Required:** `name`, `country`, `tag`, `description`, `image`.
**Optional:** `eyebrow`, `heroTitle`, `heroDescription`, `heroImage`, `pills`, `intro`/`routes`, `itineraryTitle`, `days` (`title`, `text`, `bullets`, `images`), `food`, `tip`.
Full example: `assets/sample-lisbon.json`.

## Steps

### 1. Prepare the spec
- Collect destination details from the user (prose or JSON) and save as `spec.json`.
- Confirm the `name`'s slug won't collide with existing pages: `index.html`, `interlaken.html`, `inverness.html`, `privacy-policy.html`, `travel-essentials.html`. (Slug = name lowercased, non-alphanumerics → hyphens.)

### 2. (Optional) Read current repo state
- Use the `travlzi-github` MCP `read_file` tool on `content.json` to confirm the schema and that the name isn't already used.

### 3. Dry-run preview (recommended before committing)
```powershell
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" `
  "C:\Users\Admin\.kiro\skills\travlzi-add-destination\scripts\add-destination.ts" `
  --input spec.json --dry-run
```
- Writes `./out/content.json` and `./out/<slug>.html` locally — no commit.
- Open `./out/<slug>.html` in a browser to check layout and images.

### 4. Commit and publish
```powershell
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" `
  "C:\Users\Admin\.kiro\skills\travlzi-add-destination\scripts\add-destination.ts" `
  --input spec.json
```
With `GITHUB_TOKEN` set, the script:
1. appends the destination to `content.json` (dedups by `name` — updates in place if it exists),
2. commits `content.json` then `<slug>.html` to `main`,
3. polls the Pages build every 15s up to ~10 min,
4. verifies the live URLs with cache-busted fetches.

### 5. Capture the output
The script prints an `=== RESULT ===` block. Record:
- Homepage URL — `https://thejaswis.github.io/travlzi/`
- Itinerary URL — `https://thejaswis.github.io/travlzi/<slug>.html`
- Commit URLs (one for `content.json`, one for `<slug>.html`)
- Three booleans: Homepage loads · Itinerary page loads · New destination live
- Final line: `✅ Verified …` or `⚠ Verification incomplete …`

### 6. Report to the user
Report the commit URLs, the live URLs, and the verification verdict. If incomplete, note Pages may still be propagating and re-check in a minute.

## Acceptance criteria
- Homepage returns 200.
- `<slug>.html` returns 200 and contains the destination name.
- Live `content.json` contains the destination name.
- All three true → **PASS**.

## Troubleshooting
| Symptom | Action |
|---|---|
| `401` / token error | Check `GITHUB_TOKEN` scope and expiry. |
| `content.json` commit `409` | Another commit landed; re-run (script fetches a fresh `sha`). |
| Pages build API `404` | Unreachable; script falls through to content verification. |
| Verification incomplete | Pages propagation — wait 60–90s, re-fetch URLs with a cache-bust, or re-run. |
| Destination already exists | Re-running with the same `name` updates it in place (intended). |
