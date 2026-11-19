// The roadmap to the platinum: four stages built from the official
// descriptions, in the order a player should earn them. Stage numbers
// match the `stage` field on every trophy in data/trophies.json.
export const ROADMAP_STAGES = [
  { stage: 1, title: 'Stage 1 — Story first', blurb: 'Chapters 1–4 + finale, 13 story trophies. Meditate in Chapter 1 (Positive Mental Attitude) before the chapter ends.' },
  { stage: 2, title: 'Stage 2 — Strangers & side strands', blurb: '8 stranger strands (Andy, Kenton, Billy, Randy, Tyrone, Bret…) + the cryptic story-moment trophies. 13 trophies.' },
  { stage: 3, title: 'Stage 3 — The long counts', blurb: 'Collectibles & activities: 250 stunts, 100 WAiNK spots, 100 vehicles, 42 shooting-range golds, 50 challenges, 5 bank vaults. 27 trophies.' },
  { stage: 4, title: 'Stage 4 — Platinum', blurb: '100% Completion (A Long Road, gold), then the platinum pops: Vice Got a Price! 2 trophies.' },
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
