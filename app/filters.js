// Filtering, search and the spoiler setting. A hidden story trophy stays
// masked (name + description) while spoilers are hidden and it is not
// earned; earning it reveals it. There are no online trophies, so the
// online filter honestly shows an empty list with an explanation.
// The missable filter covers the 1 flagged trophy AND the 7 trophies whose
// unlock method is not yet known: the old "Missable 1" pill hid the 7
// unknowns from anyone who never opened the missables tab.
export function isStorySpoiler(trophy, earnedIds, spoilersHidden) {
  return spoilersHidden && trophy.hidden && !earnedIds.has(trophy.id);
}

// A trophy whose guide states its exact trigger is not yet confirmed.
// Wording varies across the seven guides, so the pattern covers each form
// the guides actually use; it matches exactly the 7 unknown-method
// trophies (ids 38, 44, 45, 47, 49, 50, 51) and no other guide.
export function isMethodUnknown(trophy) {
  return /not yet confirmed|not pinned|under investigation|No confirmed step-by-step/.test(trophy.guide);
}

export function displayNameFor(trophy, earnedIds, spoilersHidden) {
  return isStorySpoiler(trophy, earnedIds, spoilersHidden) ? 'Hidden trophy — earn it to reveal' : trophy.name;
}

export function displayDescriptionFor(trophy, earnedIds, spoilersHidden) {
  return isStorySpoiler(trophy, earnedIds, spoilersHidden)
    ? 'A hidden story trophy. Its name and description stay secret until you earn it.'
    : trophy.description;
}

const GRADE_RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

export function applyTrophyFilters(trophies, options) {
  const query = (options.query ?? '').trim().toLowerCase();
  const shown = trophies.filter((trophy) => {
    if (options.kind === 'missable' && !trophy.missable && !isMethodUnknown(trophy)) return false;
    if (options.kind === 'online') return false; // no online trophies exist
    if (options.kind && options.kind !== 'all' && options.kind !== 'missable' && trophy.kind !== options.kind) return false;
    if (options.grade && options.grade !== 'all' && trophy.grade !== options.grade) return false;
    if (options.stage && options.stage !== 'all' && trophy.stage !== Number(options.stage)) return false;
    if (query) {
      const haystack = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  const sort = options.sort ?? 'roadmap';
  const counters = options.counters ?? {};
  const progressOf = (trophy) => (trophy.counter ? (counters[trophy.id] ?? 0) / trophy.counter.target : 1);
  if (sort === 'name') shown.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'grade') shown.sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || a.id - b.id);
  else if (sort === 'count') shown.sort((a, b) => progressOf(a) - progressOf(b) || a.id - b.id);
  else shown.sort((a, b) => a.stage - b.stage || a.id - b.id);
  return shown;
}

export function filterHintFor(kind, grade, query, shownCount, totalCount) {
  if (kind === 'online') {
    return 'Online: 0 trophies — GTA 6 has no online trophies. Every trophy is single-player and offline (PowerPyx, GTABase).';
  }
  const parts = [`Showing ${shownCount} of ${totalCount} trophies`];
  if (kind === 'missable') parts.push('1 flagged possibly missable + 7 method unknown');
  else if (kind && kind !== 'all') parts.push(`kind: ${kind}`);
  if (grade && grade !== 'all') parts.push(`grade: ${grade}`);
  if (query) parts.push(`matching “${query}”`);
  return `${parts.join(' · ')}.`;
}
