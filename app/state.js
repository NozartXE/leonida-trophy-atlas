// Progress state: the earned set lives in localStorage and can be exported
// to a JSON file and imported back. A ?demo=1 URL seeds a sample set of
// 13 earned trophies so screenshots show a lived-in tracker.
export const STORAGE_KEY = 'leonida-trophy-atlas-earned-v1';
export const DEMO_EARNED_IDS = [2, 3, 8, 15, 16, 20, 21, 33, 35, 42, 44, 46, 53];

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

export function applyDemoEarnedIfRequested(earnedIds) {
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    for (const id of DEMO_EARNED_IDS) earnedIds.add(id);
  }
  return earnedIds;
}

export function exportProgressToFile(earnedIds) {
  const payload = JSON.stringify({ app: 'leonida-trophy-atlas', earned: [...earnedIds].sort((a, b) => a - b) }, null, 2);
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
  return new Set(ids.filter((n) => Number.isInteger(n) && n >= 1 && n <= 55));
}
