// Progress state: the earned set and the per-trophy counters live in
// localStorage and can be exported to a JSON file and imported back.
// A ?demo=1 URL seeds a sample set of 13 earned trophies plus mid-count
// counter values (Positive Mental Attitude 9/18, You WAiNKer! 42/100,
// Whip It Good 57/100) so screenshots show a lived-in tracker.
export const STORAGE_KEY = 'leonida-trophy-atlas-earned-v1';
export const COUNTERS_KEY = 'leonida-trophy-atlas-counters-v1';
export const DEMO_EARNED_IDS = [2, 3, 8, 15, 16, 20, 21, 33, 35, 42, 44, 46, 53];
export const DEMO_COUNTERS = { 28: 9, 31: 42, 35: 57 };

export function loadEarnedSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    return new Set(Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n)) : []);
  } catch {
    return new Set();
  }
}

export function saveEarnedSet(earnedIds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earnedIds].sort((a, b) => a - b)));
}

export function loadCounters() {
  try {
    const raw = localStorage.getItem(COUNTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const counters = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (Number.isInteger(value) && value >= 0) counters[id] = value;
    }
    return counters;
  } catch {
    return {};
  }
}

export function saveCounters(counters) {
  localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
}

export function counterValueFor(counters, trophy) {
  return counters[trophy.id] ?? 0;
}

export function applyDemoStateIfRequested(earnedIds, counters) {
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    for (const id of DEMO_EARNED_IDS) earnedIds.add(id);
    for (const [id, value] of Object.entries(DEMO_COUNTERS)) {
      if (counters[id] === undefined) counters[id] = value;
    }
  }
  return { earnedIds, counters };
}

export function exportProgressToFile(earnedIds, counters) {
  const payload = JSON.stringify(
    { app: 'leonida-trophy-atlas', earned: [...earnedIds].sort((a, b) => a - b), counters },
    null,
    2,
  );
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leonida-trophy-atlas-progress.json';
  link.click();
  URL.revokeObjectURL(url);
}

export async function importProgressFromFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const ids = Array.isArray(parsed) ? parsed : parsed.earned;
  if (!Array.isArray(ids)) throw new Error('That file has no earned-trophy list.');
  const earned = new Set(ids.filter((n) => Number.isInteger(n) && n >= 1 && n <= 55));
  const counters = {};
  if (!Array.isArray(parsed) && parsed.counters && typeof parsed.counters === 'object') {
    for (const [id, value] of Object.entries(parsed.counters)) {
      const n = Number(id);
      if (Number.isInteger(n) && n >= 1 && n <= 55 && Number.isInteger(value) && value >= 0) counters[n] = value;
    }
  }
  return { earned, counters };
}
