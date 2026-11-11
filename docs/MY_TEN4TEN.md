# My TEN4TEN demo (synthetic data)

A **synthetic-data demonstration** of a participant results page for TEN4TEN, built into this site. It
uses invented people only. It is not approved for participants. The live site publishes it as a clearly labelled,
`noindex`, synthetic demo at `/my-ten4ten/`, reached from a small text link at the foot of the map
layer card. Tiny Towns Atlas remains the primary project. The demo is a frozen version (git tag
`my-ten4ten-demo-v1`) kept for review. This repository is public, so ethics, linkage and project-governance material is kept in the
restricted TEN4TEN project folder, not here.

## Run it

```bash
npm run build:my-ten4ten   # regenerate demo/my-ten4ten/data from the synthetic research store (refuses on any failed check)
npm run dev:demo           # http://localhost:5173/my-ten4ten/
npm run build:demo && npm run preview:demo   # production-like, http://localhost:4173/my-ten4ten/ (output in dist-demo/)
npm test                   # Atlas tests plus src/my-ten4ten/*.test.mjs
```

`npm run build` still produces the Atlas alone (a test builds both modes and checks the default output
contains nothing from the demo). The GitHub Pages workflow runs `npm test`, then `npm run build:demo`, and
publishes `dist-demo/`. Only `--mode demo` adds the page, the data and the link. `vite.config.ts` also denies the research folder in every dev server (the default `npm run dev`
would otherwise serve it). In plain `npm run dev` the `/my-ten4ten/` page file is still reachable, but it
shows an error panel because no demo data is served.

## What is where

| Path | Purpose |
|---|---|
| `my-ten4ten/index.html` | Page shell (extra entry point, demo builds only) |
| `src/my-ten4ten/` | App modules, styles and tests. `policy.js` holds the release rules |
| `src/my-ten4ten/entry-link.ts` | Adds the small "My TEN4TEN (demo)" text link to the layer card; loaded only in demo mode |
| `demo/my-ten4ten/research/` | Synthetic research store (identity registry, source records). **Never shipped or served** |
| `demo/my-ten4ten/build_views.mjs` | Applies the release rules, writes per-person views, checks for leakage |
| `demo/my-ten4ten/data/` | Public measure definitions, demo accounts and per-person views (synthetic, generated) |
| `demo/my-ten4ten/vite-plugin.mjs` | Serves and emits an allowlist of `data/` files, and only in demo mode |

The only edits to existing Atlas files are `vite.config.ts` (mode-gated plugin and entry, a dev-server deny
rule, production env values for demo builds), `.github/workflows/deploy.yml` (tests, then publish the
demo build), one mode-gated line in `src/main.ts`, four `package.json` scripts and one `.gitignore` line. A test fails if anything else in `main.ts` mentions the demo.

## Safeguards that must hold

- **Participant data stays separate from the Atlas.** The Atlas is public, static and aggregate. The
  research store is never shipped, never served and denied in dev. No demo data sits in `public/`.
- **Release rules fail closed.** A visit is shown only if its link is `identity_verified` and its return
  approval covers the measure's domain. Candidate, reviewed, rejected, test and withheld records never
  reach a page. The browser re-checks the shape and values of every view (`sanitiseView`). A test checks
  that the shipped views equal what the build script produces from the research store.
- **Identity comes from the demo session only,** never from the URL. The page refuses to run in a frame.
- **The Atlas assistant is not connected** to this page. A test fails if the demo references it.
- **The demo sign-in is simulated and is not security.** Demo codes are published with the page, and the
  views are public static files. A static GitHub Pages site cannot authenticate anyone, and a meta
  Content-Security-Policy cannot set `frame-ancestors`.

## Before any real participant data

Real records need a separately approved, authenticated backend that applies the same release rules on the
server. The page's only data access is `src/my-ten4ten/adapter.js`; the placeholder `createRestAdapter()`
marks where that backend plugs in. Keep the demo out of `npm run build`. Do not add real or
pseudonymised records to this repository. The service also needs the ethics approvals and sign-in design
recorded in the restricted project folder.

## Design notes

Colours, type, borders, radii, the top bar and the 700px breakpoint come from `src/style/main.css`
(imported by the page). Tiny Towns Atlas shows a town as a point within a distribution and never ranks;
this page never compares a person with anyone else. The individual over-time view is a demo feature
(`showIndividualComparisons` in `src/my-ten4ten/config.js`); the page says it is under ethics review.
