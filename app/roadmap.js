// The roadmap to the platinum: seven stages grouped by pacing and kind,
// in the order a player should earn them. Stage numbers match the `stage`
// field on every trophy in data/trophies.json; every count rendered from
// this data is computed from the trophy list at runtime, never typed in.
//
// Planning totals are the cited guides' own roadmap figures, labelled as
// estimates: PowerPyx's roadmap puts the platinum at roughly 200 hours,
// difficulty 4/10, one playthrough, no mission replay, manual saves at
// chapter starts, and cheats disabling trophies. Per-stage hour ranges
// are our estimates consistent with that ~200-hour total — stages
// overlap (background tallies run while you do other stages), so the
// ranges are a pacing guide, not a sum.
export const ROADMAP_FACTS = {
  totalHours: '~200 hours total',
  difficulty: 'Difficulty 4/10',
  playthroughs: '1 playthrough',
  saves: 'Manual saves at every chapter start',
  replay: 'No mission replay',
  cheats: 'Cheats disable trophies',
};

// The roadmap sourcing note, with the read date filled in from the
// atlas's single computed read-date range (A-1) — never typed in.
export function roadmapFactsNote(readRange) {
  return `Totals from the cited roadmap guides, read ${readRange}. Order: story, strands, collectibles, robberies, final grind.`;
}

// Hours left to the platinum, computed from our own data: each stage's
// hour range midpoint, scaled by the share of that stage still unearned.
// Stages overlap (background tallies run while you do other stages), so
// this is the same kind of estimate as the ~200 h total — not a sum of
// clock hours. Live #50's ≈173 h figure is the model, not a value copied.
export function timeToPlatinum(trophies, earnedIds) {
  let remaining = 0;
  for (const stage of ROADMAP_STAGES) {
    const m = stage.hours.match(/(\d+)[\u2013-](\d+)/);
    if (!m) continue;
    const midpoint = (Number(m[1]) + Number(m[2])) / 2;
    const p = stageProgress(trophies, earnedIds, stage.stage);
    remaining += midpoint * ((p.total - p.earned) / p.total);
  }
  return Math.round(remaining);
}

// PSN trophy points on the current PS5 scale (Oct 2020 onward): Bronze 15,
// Silver 30, Gold 90, Platinum 300 — PSN100 methodology via PlayStation
// Universe, corroborated by the live #50 entry's 195/1,350. The old
// pre-2020 scale valued the platinum at 180 (total 1,230); it no longer
// applies. Total for this list: 46x15 + 6x30 + 2x90 + 1x300 = 1,350.
export const PSN_POINTS = { bronze: 15, silver: 30, gold: 90, platinum: 300 };

export function psnPoints(trophies, earnedIds) {
  const earned = trophies.filter((trophy) => earnedIds.has(trophy.id));
  const total = trophies.reduce((sum, trophy) => sum + PSN_POINTS[trophy.grade], 0);
  const points = earned.reduce((sum, trophy) => sum + PSN_POINTS[trophy.grade], 0);
  return { points, total };
}

export const ROADMAP_STAGES = [
  { stage: 1, title: 'Stage 1 — Story first', hours: '35–45h', blurb: 'Chapters 1–4, the finale and mission trophies.' },
  { stage: 2, title: 'Stage 2 — Strangers & side strands', hours: '15–20h', blurb: 'Stranger strands and the silver for eight of them. One race is watch-listed — see Missables.' },
  { stage: 3, title: 'Stage 3 — Story moments & the background tally', hours: '10–15h', blurb: 'Story moments and the 500-action background tally.' },
  { stage: 4, title: 'Stage 4 — Collectibles & exploration', hours: '30–40h', blurb: 'Card sets, WAiNK spots, vehicles and garages.' },
  { stage: 5, title: 'Stage 5 — Ranges, races & one-off activities', hours: '35–50h', blurb: 'Range golds, races, challenges and one-off activities.' },
  { stage: 6, title: 'Stage 6 — Robberies, heat & money', hours: '25–35h', blurb: 'Vaults, shops and gang ops, plus the money tallies.' },
  { stage: 7, title: 'Stage 7 — The final grind & the platinum', hours: '20–30h', blurb: 'The 250-stunt tally ends last; A Long Road hits 100%.' },
];

export function trophiesInStage(trophies, stageNumber) {
  return trophies.filter((trophy) => trophy.stage === stageNumber);
}

export function stageProgress(trophies, earnedIds, stageNumber) {
  const stageTrophies = trophiesInStage(trophies, stageNumber);
  const earned = stageTrophies.filter((trophy) => earnedIds.has(trophy.id)).length;
  return { earned, total: stageTrophies.length };
}

export function platinumProgress(trophies, earnedIds) {
  const earned = trophies.filter((trophy) => earnedIds.has(trophy.id)).length;
  const percent = Math.round((earned / trophies.length) * 100);
  const perGrade = {};
  for (const grade of ['platinum', 'gold', 'silver', 'bronze']) {
    const ofGrade = trophies.filter((trophy) => trophy.grade === grade);
    perGrade[grade] = { earned: ofGrade.filter((trophy) => earnedIds.has(trophy.id)).length, total: ofGrade.length };
  }
  return { earned, total: trophies.length, percent, perGrade };
}
