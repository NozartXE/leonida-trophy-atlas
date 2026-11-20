// Leonida Trophy Atlas — Dusk Atlas build (2026-11-19), feature/content
// round added the same day: complete guides rendered in frame (no
// truncation), live per-trophy counters, counted filter pills, a 7-stage
// roadmap with cited planning totals, a dedicated missables view, and
// structured dated Sources lists. Density round (2026-11-20) added:
// claim-level footnote markers in every guide keyed to numbered Sources,
// a one-line audit strip with per-stage chips, counters inside the
// roadmap stages + a computed NEXT UP banner, the missables page rebuilt
// as a structured tracker, a uniform guide standard (numbered steps,
// OFFICIAL DESCRIPTION box, >=3 dated sources per guide), stage/sort
// facets and per-row stage/kind/source/counter chips. Round 5 (2026-11-20)
// added: a 55-guide citation matrix with per-source counts and OPEN/1-SRC
// flags, earned-by-grade restored + live PSN points (current scale) and
// saved-state proof, the missables table collapsed to one grouped UNKNOWN
// block plus two WATCH rows, the audit strip kept on the roadmap frame
// only, de-pilled rows with labelled counters, and varied hidden-trophy
// placeholders. Hands in app/ and
// screenshots/ with the vendored make.fun dossier builder, unchanged.
// A working gta6-trophy-guide-01 entry (Node 22, standard library only): the guide is this directory's app/ folder,
// plain static files a browser opens at app/index.html (ES modules, CSS, no build step), offline: it loads nothing
// over the network, and its trophy list and guides are app/data/trophies.json. The program hands it in: it copies app/
// and screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the judge reads (your
// screenshots, the first load's files and bytes, and your source), with the vendored make.fun library. Leave
// vendor/makefun-frontend.ts as it is: the scorer requires dossier.json to be byte for byte what its own copy writes.
//
// Only the plumbing, not a winner: a plain checklist of the 55 trophies with a one-line hint each. Write a real guide
// for every trophy in your own words, a roadmap to the platinum, filters and a spoiler setting in app/, put 3 or 4 PNG
// or JPEG screenshots of it in screenshots/ (the first by name is the cover; shots.json says which views this
// starter's were taken of), and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

// Dusk Atlas: 55 trophies, 28 hidden, 1 missable (Positive Mental Attitude).
// Round 6 (credibility + legibility): DIFFER 2, 6 sources, coverage strip
// in place of the citation matrix, de-pilled rows, split unknown rows.
// Round 7 (targeted fixes): single-source counter state + single-state
// re-capture, DIFFER 3 (meditation count, callout inside the PMA guide),
// coverage counts computed from footnotes with corroboration labelled,
// PlanetGTA6 accounted in the strip.
// Round 8 (2026-11-20): full source URLs from one shared table (Exophase
// domain-only, no verified game-page URL), one computed read-date range
// (19–20 Nov 2026) everywhere, numbered steps split from guide sentences
// with a "steps cited" claim, claim footnotes for KeenGamer/OutputLag/
// eGamers, audit strip on all four frames, type +1–2px (Dusk kept),
// Strangers & Freaks open in frame 4, PowerPyx's 100% checklist named,
// unknown 7→2 (Bad Luck, I Guess + Fair Game) per PowerPyx's live guide,
// watch list kept at 2 (hourglass finals are not trophy-relevant).
// Deterministic: same files in, same dossier bytes out — run it twice to check.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 48 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
