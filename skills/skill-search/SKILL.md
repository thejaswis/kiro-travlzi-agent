---
name: skill-search
description: Search for an airport photo of a travel destination and add it to the destination's itinerary page on the Travlzi site (thejaswis/travlzi). Can be run standalone to find and patch a photo into an existing page, or invoked automatically by travlzi-add-destination during publishing. Invoke with /skill-search.
---

## What this skill does

Finds the best available airport or arrival photo for a travel destination and injects it into the destination's itinerary page on Travlzi.

1. **Searches** Unsplash for `"<destination> airport"` (and fallback terms: `"<destination> arrival"`, `"<destination> terminal"`) using the public Unsplash Source API — no API key required.
2. **Scores** candidates: prefers landscape orientation, high resolution (≥ 1600 px wide), and query-relevance order.
3. **Builds** an airport photo object: `{ src, alt, credit }`.
4. **Patches** the destination's `<slug>.html` on GitHub — inserts the airport photo as a styled "Arriving in `<name>`" section just below the hero, before the intro section.
5. **Optionally commits** the patched HTML back to `main` via the GitHub REST API if `GITHUB_TOKEN` is present.
6. **Returns** the photo object (URL, alt text, credit line) so the caller (`travlzi-add-destination`) can embed it at HTML generation time instead of patching later.

## Invoke word

`/skill-search` — then give the destination name and (optionally) the slug.

```
/skill-search --destination "Lisbon" --slug "lisbon"
/skill-search --destination "Inverness"              # slug inferred from name
/skill-search --destination "Tokyo" --dry-run        # print result, no commit
/skill-search --destination "Tokyo" --patch          # find + commit patch to live page
```

## Prerequisites

- No API key needed for photo search (Unsplash Source / oEmbed public endpoint).
- **`GITHUB_TOKEN`** (write access to `thejaswis/travlzi`) only required when committing a patch (`--patch` without `--dry-run`).
- Kiro-bundled Bun at `C:\Users\Admin\AppData\Local\Kiro-Cli\bun.exe`.

## Workflow (follow when invoked)

1. **Collect input.** Destination name is required. Slug defaults to name lowercased with non-alphanumerics → hyphens.
2. **Search photos.** Run the script:
   ```powershell
   & "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" `
     "C:\Users\Admin\.kiro\skills\skill-search\scripts\search-airport-photo.ts" `
     --destination "Lisbon" [--slug "lisbon"] [--dry-run] [--patch]
   ```
3. **Report the photo.** Print the selected photo URL, alt text, credit, and the Unsplash page link.
4. **Patch the page (if `--patch`).** Fetch `<slug>.html` from GitHub, insert the airport section, commit back to `main`.
5. **Verify (if `--patch` and not `--dry-run`).** Fetch the live page and confirm the airport section is present.
6. **Return JSON** to the caller when used as a sub-skill:
   ```json
   { "src": "https://…", "alt": "Lisbon airport terminal", "credit": "Photo by … on Unsplash" }
   ```

## How travlzi-add-destination uses this skill

`add-destination.ts` calls `search-airport-photo.ts --destination <name> --dry-run` as a subprocess before generating the itinerary HTML. The returned JSON is merged into the spec as `spec.airportPhoto`, which the HTML builder uses to render the "Arriving in `<name>`" section. This means the airport photo is baked into the page at commit time — no separate patch step needed.

If the subprocess fails (network unavailable, no results), `travlzi-add-destination` falls back gracefully: the airport section is omitted and a warning is logged.

## Notes

- Unsplash Source (`https://source.unsplash.com`) serves a redirect to a random photo matching the query. The script uses the oEmbed/search endpoint to get structured metadata.
- The airport section HTML is a single `<figure>` card with a caption, styled with the site's existing CSS variables. See `references/workflow.md` for the exact markup.
- Running `/skill-search --patch` on an already-patched page is idempotent: the script detects the existing section and skips re-insertion.
