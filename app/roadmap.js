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
  replay: 'No mission replay — a missed Chapter 1 spot cannot be replayed',
  cheats: 'Cheats disable trophies — keep them off for the whole run',
  note: 'Totals from the cited roadmap guides (PowerPyx, GTABase), read 19 Nov 2026. Per-stage hours are estimates consistent with that total.',
};

export const ROADMAP_STAGES = [
  { stage: 1, title: 'Stage 1 — Story first', hours: '35–45h', blurb: 'Chapters 1–4, the finale and the required mission trophies — plus Positive Mental Attitude, which must be started at home in Chapter 1 before that chapter ends.' },
  { stage: 2, title: 'Stage 2 — Strangers & side strands', hours: '15–20h', blurb: 'The stranger strands (Andy, Kenton, Billy, Randy, Tyrone, Bret) and the silver for finishing eight of them. Strands stay open after the story, so nothing here can be lost.' },
  { stage: 3, title: 'Stage 3 — Story moments & the background tally', hours: '10–15h', blurb: 'The cryptic story-moment trophies, most with methods not yet confirmed, and Actions Speak Louder — a 500-action background tally that grows while you play everything else.' },
  { stage: 4, title: 'Stage 4 — Collectibles & exploration', hours: '30–40h', blurb: 'Card sets, the 100 WAiNK locations, 100 discovered vehicles, the full map and every garage — the sweep of Leonida, best done region by region.' },
  { stage: 5, title: 'Stage 5 — Ranges, races & one-off activities', hours: '35–50h', blurb: 'Shooting-range golds, races, challenges and the one-off activity trophies (bowling, the arcade, the tank encounter, the airport departure).' },
  { stage: 6, title: 'Stage 6 — Robberies, heat & money', hours: '25–35h', blurb: 'Bank vaults, shop chains, the armored truck, gang operations — and the two money tallies, $250,000 laundered and $100,000 spent.' },
  { stage: 7, title: 'Stage 7 — The final grind & the platinum', hours: '20–30h', blurb: 'The 250-stunt tally finishes last, A Long Road lands at 100% completion, and Vice Got a Price! pops on top of the other 54.' },
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
