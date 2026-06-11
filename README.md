# Minna SRS — Book 2

A minimalist, distraction-free spaced-repetition system for learning grammar from **Minna no Nihongo Book 2** (chapters 26-50).

**Live:** https://alexistonneau.github.io/japanese-grammar-srs/

---

## Why this exists

Bunpro is cluttered. Anki's Right/Wrong grading is too binary for grammar nuance — Book 2 hinges on context and politeness levels, not 1:1 translations.

This app trades feature breadth for a clean review loop and a 3-button "vibe check" grading system focused on comprehension.

## Screenshots

### Dashboard
Chapter grid with per-chapter mastered counts and a single "Review Due" CTA.

![Dashboard](docs/screenshots/dashboard.png)

### Review card — front
Large Japanese typography, optional TTS, single "Show Answer" action.

![Review card front](docs/screenshots/review-front.png)

### Review card — back
Grammar point, translation, and a structural/nuance note. Three grades: **Forgot** resets the interval, **Understood** advances normally, **Easy** pushes the interval far out.

![Review card back](docs/screenshots/review-back.png)

## Features

- **3-button comprehension grading** — Forgot / Understood / Easy
- **Simplified SM-2 algorithm** with per-item `interval`, `easeFactor`, and `nextReviewDate`
- **localStorage-backed progress** — no account, no backend
- **Web Speech API** for Japanese TTS (uses your OS's `ja-JP` voices)
- **153 grammar items** seeded across all 25 chapters of Book 2

## Tech

- Vite + React 18 + TypeScript
- Tailwind CSS
- Lucide React icons
- Web Speech API for TTS
- GitHub Pages deployment via Actions

## Project structure

```
src/
├── App.tsx                  view router (dashboard ↔ review)
├── data/grammarData.ts      curriculum content (immutable)
├── srs/
│   ├── types.ts             Grade, Progress, ProgressStore
│   ├── algorithm.ts         pure SM-2-lite (no React)
│   ├── storage.ts           localStorage adapter
│   └── useSrs.ts            React hook over algorithm + store
├── lib/tts.ts               Web Speech API wrapper
└── components/
    ├── Dashboard.tsx
    ├── ReviewSession.tsx
    └── ReviewCard.tsx
```

The curriculum (`grammarData.ts`) and the progress layer (`storage.ts`) are deliberately separated — swapping localStorage for Supabase later means changing `storage.ts` only.

## Development

```bash
npm install
npm run dev          # http://localhost:5173/japanese-grammar-srs/
npm run build        # typecheck + production bundle to dist/
```

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. The Vite `base` config is set to `/japanese-grammar-srs/` to match the Pages subpath.

## Roadmap

- Keyboard shortcuts (Space = show answer, 1/2/3 = grade)
- Daily new-card cap and review limit
- Settings panel: reset progress, export/import
- Migrate progress to Supabase (multi-device sync)

## Source attribution

Grammar points and example sentences seeded from [learnjapaneseaz.com](https://learnjapaneseaz.com/) lessons 26-50, with corrections to typos and translations against standard Minna no Nihongo Book 2 text.
