# skill-search — detailed reference

## Search strategy

The script tries three query terms in order and uses the first that returns ≥ 1 result:

| Priority | Query |
|---|---|
| 1 | `<destination> airport` |
| 2 | `<destination> arrival terminal` |
| 3 | `<destination> skyline` |

### Unsplash endpoints used

1. **Search API** (no key): `https://unsplash.com/napi/search/photos?query=<q>&per_page=5`
   - Returns up to 5 photos with `id`, `width`, `height`, `alt_description`, `urls.regular` (1080px), `urls.full`, `user.name`, `links.html`.
   - Scored by: landscape orientation (+2), width ≥ 1600 (+1), result index position (0 = +3 … 4 = 0).
   - Highest score wins.

2. **Fallback** (if search API unavailable): `https://source.unsplash.com/1600x900/?<query>` — follows the redirect, uses the final URL as `src`. No metadata; `alt` and `credit` are synthesized from the query string.

## Output JSON

```json
{
  "src": "https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=1200&q=85",
  "alt": "<destination> airport terminal",
  "credit": "Photo by <photographer> on Unsplash",
  "unsplashUrl": "https://unsplash.com/photos/<id>",
  "query": "<destination> airport",
  "fallback": false
}
```

`fallback: true` when the Source redirect was used instead of the search API.

## Airport section HTML injected into the page

Inserted immediately before `<section class="intro">`:

```html
<!-- airport-photo-section -->
<section class="airport-arrival">
  <div class="airport-inner">
    <div class="eyebrow" style="color:var(--teal)">ARRIVING IN <DESTINATION></div>
    <figure class="airport-figure">
      <img src="<src>" alt="<alt>" loading="lazy">
      <figcaption><credit></figcaption>
    </figure>
  </div>
</section>
<!-- /airport-photo-section -->
```

Additional CSS injected into the page's `<style>` block (appended before `</style>`):

```css
.airport-arrival{max-width:1120px;margin:60px auto 0;padding:0 24px}
.airport-figure{margin:18px 0 0}
.airport-figure img{width:100%;max-height:480px;object-fit:cover;object-position:center;border-radius:16px;display:block}
.airport-figure figcaption{margin-top:8px;font-size:.78rem;color:var(--muted);text-align:right}
```

## Idempotency

Before inserting, the script checks for the HTML comment `<!-- airport-photo-section -->`. If found, it skips insertion and logs `[skip] airport section already present`. Pass `--force` to overwrite.

## Token requirements

Same as `travlzi-add-destination`:
- Classic PAT: `repo` scope.
- Fine-grained PAT: `Contents: Read and write`.
- Only needed when committing (`--patch` without `--dry-run`).

## Integration with travlzi-add-destination

`add-destination.ts` runs:
```ts
const result = Bun.spawnSync([
  BUN_EXE,
  SEARCH_SCRIPT,
  "--destination", spec.name,
  "--slug", slug,
  "--dry-run",         // no commit — add-destination handles the commit
  "--json",            // machine-readable output on stdout
]);
const airportPhoto = JSON.parse(result.stdout.toString());
spec.airportPhoto = airportPhoto;  // merged before buildHtml()
```

`buildHtml()` reads `spec.airportPhoto` and renders the airport section at HTML generation time. No separate patch commit is needed.

## Running standalone

```powershell
# Find photo, print result only
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" `
  "C:\Users\Admin\.kiro\skills\skill-search\scripts\search-airport-photo.ts" `
  --destination "Tokyo" --dry-run

# Find photo + patch and commit to live page
$env:GITHUB_TOKEN = "ghp_..."
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" `
  "C:\Users\Admin\.kiro\skills\skill-search\scripts\search-airport-photo.ts" `
  --destination "Tokyo" --patch

# Force-replace an existing airport section
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" `
  "C:\Users\Admin\.kiro\skills\skill-search\scripts\search-airport-photo.ts" `
  --destination "Tokyo" --patch --force
```
