// Filtering, search and the spoiler setting. A hidden story trophy stays
// masked (name + description) while spoilers are hidden and it is not
// earned; earning it reveals it. There are no online trophies, so the
// online filter honestly shows an empty list with an explanation.
export function isStorySpoiler(trophy, earnedIds, spoilersHidden) {
  return spoilersHidden && trophy.hidden && !earnedIds.has(trophy.id);
}

export function displayNameFor(trophy, earnedIds, spoilersHidden) {
  return isStorySpoiler(trophy, earnedIds, spoilersHidden) ? 'Hidden trophy — earn it to reveal' : trophy.name;
}

export function displayDescriptionFor(trophy, earnedIds, spoilersHidden) {
  return isStorySpoiler(trophy, earnedIds, spoilersHidden)
    ? 'A hidden story trophy. Its name and description stay secret until you earn it.'
    : trophy.description;
}

export function applyTrophyFilters(trophies, options) {
  const query = (options.query ?? '').trim().toLowerCase();
  return trophies.filter((trophy) => {
    if (options.kind === 'missable' && !trophy.missable) return false;
    if (options.kind === 'online') return false; // no online trophies exist
    if (options.kind && options.kind !== 'all' && options.kind !== 'missable' && trophy.kind !== options.kind) return false;
    if (options.grade && options.grade !== 'all' && trophy.grade !== options.grade) return false;
    if (query) {
      const haystack = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function filterHintFor(kind, grade, query, shownCount, totalCount) {
  if (kind === 'online') {
    return 'Online: 0 trophies — GTA 6 has no online trophies. Every trophy is single-player and offline (PowerPyx, GTABase).';
  }
  const parts = [`Showing ${shownCount} of ${totalCount} trophies`];
  if (kind && kind !== 'all') parts.push(`kind: ${kind}`);
  if (grade && grade !== 'all') parts.push(`grade: ${grade}`);
  if (query) parts.push(`matching “${query}”`);
  return `${parts.join(' · ')}.`;
}
