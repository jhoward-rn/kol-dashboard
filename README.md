# KOL Engagement Tracker

A single-page dashboard for planning, segmenting, and tracking interactions with Key Opinion Leaders (KOLs) across geographies and therapeutic areas.

Built for medical affairs and field teams managing KOL relationships over time.

---

## Overview

The KOL Engagement Tracker gives teams a shared, real-time view of each KOL's advocacy status, engagement history, and influence. It supports quarterly planning cycles with clear visibility into who has been reached, where they sit on the advocacy journey, and what actions are needed next.

---

## Features

### KOL Management
- Full KOL roster with tier, country, specialty, and institutional affiliation
- Filter and sort by segment, tier, country, specialty, and engagement status
- Side-by-side KOL comparison across key attributes

### Segmentation
KOLs are classified into four segments based on **vocality** (high/low) and **belief** (high/low):

| Segment | Vocality | Belief | Objective |
|---|---|---|---|
| **Vocal Advocate** | High | High | Amplify |
| **Quiet Champion** | Low | High | Activate |
| **Cautious Skeptic** | Low | Low | Strengthen |
| **Unconvinced Leader** | High | Low | Realign |

### Segment Evolution
- Interactive time slider showing segment distribution from Q4 2020 through Q2 2026
- Play/pause animation to visualise the advocacy journey over time
- Per-KOL segment history tracked in `kols.json`

### Engagements
- Planned and completed engagement tracking by quarter
- Timeline view in each KOL profile, sorted most-recent first
- Aggregate KPIs: completed, total, and planned-this-quarter coverage

### Influence Scoring
- Three dimensions: **Clinical**, **Geographic**, **Online**
- Average score per dimension displayed as a percentage bar
- Trend indicators (rising / flat / declining) per KOL per dimension

### Regional View
- KOLs by country with segmented bars (color-coded by segment)
- Medical Expert (ME) vs Rising Star (RS) tier breakdown per country
- Segment color legend

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Vanilla HTML/CSS/JS (no build step) |
| Icons | [Lucide](https://lucide.dev/) (CDN) |
| Data | `kols.json` → compiled to `data.js` at build time |
| Fonts / Tokens | `rn-tokens.css` (Red Nucleus design system) |
| Hosting | [Vercel](https://vercel.com) (static) |

---

## Project Structure

```
kol-dashboard/
├── index.html        # App shell, CSS, layout
├── hifi.js           # KOLs tab: KPI tiles, table, profile panel, compare modal
├── screens.js        # Engagements, Insights, Settings tabs; Segment Quadrant
├── data.js           # Auto-generated — do not edit directly
├── kols.json         # Source of truth for all KOL data
└── rn-tokens.css     # Red Nucleus design tokens
```

> **`data.js` is generated.** After editing `kols.json`, run the appropriate Python script (e.g. `rename_kols.py`, `redo_segment_history.py`) to rebuild it.

---

## Data Model

Each KOL in `kols.json` has the following shape:

```jsonc
{
  "name": "Hiroshi Tanaka",
  "institution": "Tokyo Medical University Hospital",
  "country": "Japan",
  "tier": "Medical Expert",          // "Medical Expert" | "Rising Star"
  "specialty": "Bone & Metabolic",
  "segment": "Vocal Advocate",
  "segmentMeta": {
    "vocality": "high",
    "belief": "high",
    "objective": "Amplify"
  },
  "segmentHistory": [
    { "quarter": "Q4 '20", "segment": "Cautious Skeptic" },
    { "quarter": "Q2 '24", "segment": "Quiet Champion" },
    { "quarter": "Q1 '26", "segment": "Vocal Advocate" }
  ],
  "plannedThisQuarter": true,
  "influence": {
    "clinical":   { "score": 82, "trend": "up" },
    "geographic": { "score": 74, "trend": "flat" },
    "online":     { "score": 61, "trend": "up" }
  },
  "engagements": [
    { "quarter": "Q1 '26", "type": "Advisory Board", "planned": true },
    { "quarter": "Q4 '25", "type": "1:1 Meeting",    "planned": false }
  ]
}
```

---

## Local Development

No build step required — open `index.html` directly in a browser, or serve it with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

### Updating KOL data

1. Edit `kols.json` directly, or run one of the Python utility scripts in the workspace root
2. Rebuild `data.js`:

```bash
python3 -c "
import json
with open('kols.json') as f: d = f.read()
with open('data.js', 'w') as f: f.write('var __KOLS_DATA = ' + d + ';')
"
```

---

## Deployment

The project is deployed as a static site on Vercel. Push to `main` to trigger an automatic deployment.

```bash
git push origin main
```

Manual deploy via Vercel CLI:

```bash
vercel --prod
```
