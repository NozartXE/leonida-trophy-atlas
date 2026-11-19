[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/NozartXE/leonida-trophy-atlas/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/NozartXE/leonida-trophy-atlas/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# Leonida Trophy Atlas

An offline web app: a guide and tracker for all 55 GTA 6 trophies on PlayStation 5.

Every trophy is listed with its official name, description, and grade (Platinum, Gold, Silver, Bronze). Each one has its own guide, written for this atlas, with the sources named per claim — numbered steps, claim-level footnotes, and a dated Sources list. Where sources disagree, both versions are shown rather than one being silently picked.

The atlas also includes:

- A 7-stage roadmap to the platinum, totalling roughly 148 hours, with per-stage planning figures.
- Missable, watch, and unknown tracking — trophies are flagged as missable, watch, or unconfirmed where the evidence supports it, and the missables view lays out the honest case for each.
- Progress tracking saved in the browser (`localStorage`): tick trophies off, use the per-trophy counters, and export or import your saved progress.
- Kind filters (story, missable, collectibles, activities, online, and more) plus search, stage and sort controls.
- A spoiler setting that masks hidden trophies until you choose to reveal them.

It loads nothing over the network — the trophy list and guides live in `app/data/trophies.json` and the whole app runs from local files.

## How to run

Open `app/index.html` in a desktop browser. It works offline, with no build step.

Alternatively, serve the `app/` folder statically with any static file server.

To build the submission dossier:

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `app/` and `screenshots/` into the output directory and writes `dossier.json` there.

## Bounty

This entry was built for the make.fun bounty [gta6-trophy-guide-01](https://make.fun/bounty/gta6-trophy-guide-01).

Referral link: https://make.fun/r/b9zyas72

## License

MIT — see [LICENSE](LICENSE).
