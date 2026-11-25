---
name: travlzi-add-destination
description: Add a new travel destination to the Travlzi site (thejaswis/travlzi) — a homepage card plus a full itinerary page with images — then commit to GitHub, wait for the GitHub Pages deployment to finish, and verify the live page loads accurately. Use when adding a destination to Travlzi, publishing an itinerary, or deploying a site update. Invoke with /travlzi-add-destination.
---

## What this skill does

End-to-end: adds a destination to the Travlzi static site and publishes it.

1. Reads the repo via the `travlzi-github` MCP (server registered in `~/.kiro/settings/mcp.json`) to see the current `content.json` schema and avoid name clashes.
2. Invokes the **`skill-search`** skill to find an airport photo for the destination and embeds it in the itinerary page (skip with `--no-airport-photo` or by pre-setting `spec.airportPhoto`).
3. Adds a destination **card** to `content.json` (rendered on the homepage by `script.js`) with `detailsUrl: "<slug>.html"`.
4. Generates a dedicated **itinerary page** `<slug>.html` (day-by-day plan + image gallery + airport photo section), matching the site's existing style (`inverness.html` / `interlaken.html`).
5. Commits both files to the `main` branch via the GitHub REST API — **no local `git` needed** (this machine has none).
6. Waits for the GitHub Pages "Deploy from branch" build to finish.
7. Verifies the live site loads and the new destination is present; reports pass/fail with the deployed URLs.

## Invoke word

`/travlzi-add-destination` — then give the destination details. You can hand them in prose, or pass a JSON spec file: `/travlzi-add-destination --input spec.json`.

## Prerequisites

- **`GITHUB_TOKEN`** with write access to `thejaswis/travlzi` (classic `repo` scope, or fine-grained with `Contents: Read and write` + `Pages: Read`). The repo is public, but writes always require auth. Without a token, only `--dry-run` works (generates files locally, no commit).
- The `travlzi-github` MCP server connected (already configured) for reading repo context.

## Workflow (follow when invoked)

1. **Collect the spec.** Confirm with the user: `name`, `country`, `tag` (short label), `description` (homepage blurb), `image` (hero/card image URL), and the `itinerary` — a list of days, each with a title, a paragraph, bullet activities, and 1–2 gallery image URLs. Optional: intro/getting-there route cards, food cards, and a "Travlzi tip". Image URLs follow the repo's existing pattern (Unsplash or `images/...`); see `references/workflow.md` for the exact JSON shape.
2. **Read current state.** Use the `travlzi-github` MCP `read_file` tool on `content.json` to confirm the schema and that the name is not already used.
3. **Run the script** with Bun and the spec:
   ```
   & "C:\Users\Admin\AppData\Local\Kiro-Cli\bun.exe" "C:\Users\Admin\.kiro\skills\travlzi-add-destination\scripts\add-destination.ts" --input spec.json
   ```
   The script automatically calls `skill-search` to find an airport photo and embed it in the page. Pass `--no-airport-photo` to skip. With `GITHUB_TOKEN` in the environment it commits, waits for deploy, and verifies. Add `--dry-run` to preview into `./out` without committing.
4. **Report** the commit URLs, the live homepage + itinerary URLs, and the verification verdict to the user. If verification is incomplete, note Pages may still be propagating and re-check in a minute.

## Dry run

`... add-destination.ts --input spec.json --dry-run` writes `./out/content.json` and `./out/<slug>.html` locally so you can preview before committing. A ready sample is at `assets/sample-lisbon.json`.

## Notes

- The site has no build step — `content.json` + static HTML are served as-is by GitHub Pages. Edits to `main` trigger a deploy automatically.
- `script.js` ships a `fallbackContent` copy of the destinations; this skill does **not** sync it (the live site fetches `content.json` at runtime with `cache: no-store`). Updating the fallback is optional and out of scope unless asked.
- **`skill-search`** is invoked automatically as a subprocess (`--json` mode) to find an airport photo. If it fails (network unavailable, no results), the airport section is omitted and the rest of the page is unaffected.
- Detailed spec shape and behavior: see `references/workflow.md`.
