# add-destination — detailed reference

## Input spec (JSON)

```json
{
  "name": "Lisbon",
  "country": "Portugal",
  "tag": "Sunlit city break",
  "description": "Tram rides, pastel streets, riverside light, and evenings of fado and fresh seafood.",
  "image": "https://images.unsplash.com/photo-1555881400-74a431a3c7fa?auto=format&fit=crop&w=900&q=85",
  "eyebrow": "PORTUGAL · A SUN-DRENCHED CITY BREAK",
  "heroTitle": "Lisbon,<br><em>take it slow.</em>",
  "heroDescription": "Optional longer hero paragraph. Falls back to `description`.",
  "pills": ["3-day itinerary", "Tram rides", "Riverside light"],
  "intro": {
    "title": "Getting to Lisbon",
    "text": "How travellers typically arrive.",
    "routes": [
      { "name": "Lisbon Airport (LIS)", "text": "About 20–30 minutes to the centre by metro or bus." },
      { "name": "From Porto", "text": "Roughly 2.5–3 hours by train." }
    ]
  },
  "itineraryTitle": "A loose three-day wander through the city.",
  "days": [
    {
      "title": "Alfama & the old quarter",
      "text": "Lose yourself in tiled lanes and listen for fado drifting from open doorways.",
      "bullets": [
        "Ride the historic Tram 28 through Alfama and Graça.",
        "Climb to a viewpoint (miradouro) for rooftops and river light.",
        "End with a fado dinner in a small tasca."
      ],
      "images": [
        { "src": "https://images.unsplash.com/photo-1513735492246-483525079686?auto=format&fit=crop&w=900&q=85", "alt": "Alfama rooftops" }
      ]
    }
  ],
  "food": [
    { "title": "Pastéis de nata", "text": "Warm custard tarts, best with a bica (espresso)." },
    { "title": "Tasca petiscos", "text": "Small plates of bacalhau, olives, and cheese." }
  ],
  "tip": { "title": "Travlzi tip: ride the trams off-peak", "text": "Tram 28 gets crowded by mid-morning. Ride early or late, and wear comfortable shoes for the hills." }
}
```

Only `name`, `country`, `tag`, `description`, and `image` are effectively required to produce a homepage card. Everything else is optional and the page renders without it.

## What the script does

1. **Fetch** `content.json` (`GET /repos/thejaswis/travlzi/contents/content.json?ref=main`), decode base64, parse.
2. **Append or update** the destination entry `{name, country, tag, description, image, detailsUrl:"<slug>.html"}`. If a destination with the same `name` exists, it is updated in place.
3. **Generate** `<slug>.html` using the site's shared CSS and the spec's sections (hero, intro/routes, day-by-day itinerary with galleries, food cards, tip). `slug` is `name` lowercased, non-alphanumerics → hyphens.
4. **Commit** both files to `main` via `PUT /repos/.../contents/<path>` (one commit each). `content.json` carries the existing blob `sha`; the new HTML page is created (or updated if it already exists).
5. **Wait for deploy** — poll `GET /repos/thejaswis/travlzi/pages/builds/latest` every 15s up to ~10 min until `status:"built"` (tolerates `404` if the Pages builds API is unreachable, then falls through to content verification).
6. **Verify** — fetch `https://thejaswis.github.io/travlzi/`, `…/content.json`, and `…/<slug>.html` (cache-busted), confirming the homepage returns 200, the itinerary page returns 200 and contains the destination name, and the live `content.json` contains the destination name. Retries for ~80s.
7. **Report** commit URLs, live URLs, and the verification verdict.

## Token requirements

- Classic PAT: `repo` scope covers Contents write + Pages read.
- Fine-grained PAT: repository `Contents: Read and write` + `Pages: Read`.
- `--dry-run` needs no token (no network writes; it still reads `content.json` from the API anonymously, which is fine for a public repo).

## Slug / file collisions

The script checks for an existing `<slug>.html` before committing and updates it if present. Existing top-level HTML files to avoid colliding with: `index.html`, `interlaken.html`, `inverness.html`, `privacy-policy.html`, `travel-essentials.html`. Pick a `name` whose slug won't match these.

## Re-running

Re-running with the same `name` updates the existing destination entry and overwrites the itinerary page — useful to edit content. To remove a destination, edit `content.json` on GitHub directly (out of scope for this skill unless asked).
