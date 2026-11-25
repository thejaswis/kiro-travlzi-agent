# kiro-travlzi-agent

Kiro agent skills for the [Travlzi](https://thejaswis.github.io/travlzi/) travel site.

## Skills

### 	ravlzi-add-destination
Add a new travel destination end-to-end: homepage card + full itinerary page with images, committed to GitHub and deployed to GitHub Pages.

Invoke with /travlzi-add-destination or run directly:
```powershell
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" "skills/travlzi-add-destination/scripts/add-destination.ts" --input spec.json
```

Automatically calls skill-search to embed an airport photo in the page. Pass --no-airport-photo to skip.

**Files**
```
skills/travlzi-add-destination/
├── SKILL.md                    # skill definition + invoke instructions
├── assets/sample-lisbon.json   # ready-to-run example spec
├── references/workflow.md      # detailed JSON spec shape + script internals
├── references/SOP.md           # standard operating procedure
└── scripts/add-destination.ts  # executable (Bun/TypeScript)
```

---

### skill-search
Find an airport or arrival photo for a destination on Unsplash and inject it into the destination's itinerary page.

Invoke with /skill-search or run directly:
```powershell
# find + print only
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" "skills/skill-search/scripts/search-airport-photo.ts" --destination "Tokyo" --dry-run

# find + patch live page (needs GITHUB_TOKEN)
& "$env:LOCALAPPDATA\Kiro-Cli\bun.exe" "skills/skill-search/scripts/search-airport-photo.ts" --destination "Tokyo" --patch
```

**Files**
```
skills/skill-search/
├── SKILL.md                           # skill definition + invoke instructions
├── assets/sample-output.json          # example output JSON
├── references/workflow.md             # search strategy + HTML patch spec
└── scripts/search-airport-photo.ts    # executable (Bun/TypeScript)
```

---

## Prerequisites

- **GITHUB_TOKEN** with write access to 	hejaswis/travlzi (classic PAT epo scope, or fine-grained Contents: Read and write + Pages: Read). Not needed for --dry-run.
- Kiro-bundled Bun at %LOCALAPPDATA%\Kiro-Cli\bun.exe.
- 	ravlzi-github MCP server configured in ~/.kiro/settings/mcp.json.