// Leonida Trophy Atlas — bootstrap: loads the trophy data, renders the
// checklist + open guide + progress card + roadmap, and wires the
// toolbar (search, kind/grade filters, spoiler toggle, export/import).
import { STORAGE_KEY, applyDemoEarnedIfRequested, exportProgressToFile, importProgressFromFile, loadEarnedSet, saveEarnedSet } from './state.js';
import { applyTrophyFilters, displayDescriptionFor, displayNameFor, filterHintFor, isStorySpoiler } from './filters.js';
import { ROADMAP_STAGES, platinumProgress, stageProgress, trophiesInStage } from './roadmap.js';

const params = new URLSearchParams(location.search);
const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const byId = new Map(trophies.map((trophy) => [trophy.id, trophy]));

let earnedIds = loadEarnedSet();
earnedIds = applyDemoEarnedIfRequested(earnedIds);
let selectedId = Number(params.get('select')) || 28;
if (!byId.has(selectedId)) selectedId = 28;

const viewState = {
  query: params.get('q') ?? '',
  kind: params.get('kind') ?? 'all',
  grade: params.get('grade') ?? 'all',
  spoilersHidden: params.get('spoiler') === 'off' ? false : true,
};

const listEl = document.getElementById('trophyList');
const panelEl = document.getElementById('guidePanel');
const searchBox = document.getElementById('searchBox');
const gradeSelect = document.getElementById('gradeSelect');
const spoilerToggle = document.getElementById('spoilerToggle');

if (params.get('view') === 'roadmap') document.body.classList.add('view-roadmap');
searchBox.value = viewState.query;
gradeSelect.value = viewState.grade;
spoilerToggle.checked = viewState.spoilersHidden;
for (const button of document.querySelectorAll('#kindFilters button')) {
  button.classList.toggle('active', button.dataset.kind === viewState.kind);
}

function gradeChip(trophy) {
  return `<span class="chip ${trophy.grade}">${trophy.grade}</span>`;
}

function renderProgressCard() {
  const progress = platinumProgress(trophies, earnedIds);
  document.getElementById('progressCount').textContent = `${progress.earned}/${progress.total}`;
  document.getElementById('progressPct').textContent = `${progress.percent}% to platinum`;
  document.getElementById('progressFill').style.width = `${progress.percent}%`;
  const g = progress.perGrade;
  document.getElementById('progressGrades').textContent =
    `Platinum ${g.platinum.earned}/${g.platinum.total} · Gold ${g.gold.earned}/${g.gold.total} · Silver ${g.silver.earned}/${g.silver.total} · Bronze ${g.bronze.earned}/${g.bronze.total}`;
  document.getElementById('progressNote').textContent =
    progress.earned === 0 ? 'Tick a trophy off and it stays ticked — saved in this browser.' :
    progress.earned === progress.total ? 'Platinum earned — Vice Got a Price! You are a Leonida Legend.' :
    `${progress.total - progress.earned} trophies left. Next up: finish Stage ${nextOpenStage()} of the roadmap.`;
}

function nextOpenStage() {
  for (const stage of ROADMAP_STAGES) {
    const p = stageProgress(trophies, earnedIds, stage.stage);
    if (p.earned < p.total) return stage.stage;
  }
  return 4;
}

function renderRoadmapStrip() {
  const strip = document.getElementById('roadmapStrip');
  strip.replaceChildren();
  for (const stage of ROADMAP_STAGES) {
    const p = stageProgress(trophies, earnedIds, stage.stage);
    const div = document.createElement('div');
    div.className = 'stage';
    div.innerHTML = `<b>${stage.title}</b><span class="n">${p.earned}/${p.total} earned — ${stage.blurb}</span>`;
    strip.append(div);
  }
}

function renderRoadmapCards() {
  const cards = document.getElementById('stageCards');
  cards.replaceChildren();
  for (const stage of ROADMAP_STAGES) {
    const stageTrophies = trophiesInStage(trophies, stage.stage);
    const p = stageProgress(trophies, earnedIds, stage.stage);
    const card = document.createElement('article');
    card.className = 'stage-card';
    const items = stageTrophies.map((trophy) => {
      const name = isStorySpoiler(trophy, earnedIds, viewState.spoilersHidden) ? 'Hidden story trophy' : trophy.name;
      return `<li class="${earnedIds.has(trophy.id) ? 'earned' : ''}">${earnedIds.has(trophy.id) ? '✓ ' : ''}${name} <span style="color:var(--cream-dim)">(${trophy.grade})</span></li>`;
    }).join('');
    card.innerHTML = `<h3>${stage.title}</h3><p class="stage-count">${p.earned}/${p.total} earned</p><p class="stage-count">${stage.blurb}</p><ul>${items}</ul>`;
    cards.append(card);
  }
}

function renderChecklist() {
  const shown = applyTrophyFilters(trophies, viewState);
  document.getElementById('listCount').textContent = `(${shown.length})`;
  document.getElementById('listHint').textContent = filterHintFor(viewState.kind, viewState.grade, viewState.query, shown.length, trophies.length);
  listEl.replaceChildren();
  for (const trophy of shown) {
    const li = document.createElement('li');
    li.className = (earnedIds.has(trophy.id) ? 'earned' : '') + (trophy.id === selectedId ? ' selected' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earnedIds.has(trophy.id);
    box.setAttribute('aria-label', `Earned: ${displayNameFor(trophy, earnedIds, viewState.spoilersHidden)}`);
    box.addEventListener('change', () => {
      if (box.checked) earnedIds.add(trophy.id); else earnedIds.delete(trophy.id);
      saveEarnedSet(earnedIds);
      renderAll();
    });
    const body = document.createElement('div');
    body.className = 't-body';
    const chips = [gradeChip(trophy)];
    if (trophy.hidden) chips.push('<span class="chip hidden">Hidden</span>');
    if (trophy.missable) chips.push('<span class="chip missable">Missable</span>');
    if (trophy.count) chips.push(`<span class="chip count">×${trophy.count}</span>`);
    body.innerHTML = `<div class="t-name">${displayNameFor(trophy, earnedIds, viewState.spoilersHidden)}</div>` +
      `<div class="t-desc">${displayDescriptionFor(trophy, earnedIds, viewState.spoilersHidden)}</div>` +
      `<div class="t-meta">${chips.join('')}</div>`;
    li.append(box, body);
    li.addEventListener('click', (event) => {
      if (event.target === box) return;
      selectedId = trophy.id;
      renderChecklist();
      renderGuidePanel();
    });
    listEl.append(li);
  }
}

function renderGuidePanel() {
  const trophy = byId.get(selectedId);
  const masked = isStorySpoiler(trophy, earnedIds, viewState.spoilersHidden);
  const kindLabel = trophy.missable ? 'MISSABLE · ' : '';
  const warn = trophy.missable
    ? `<p class="g-warn"><b>⚠ Missable:</b> the Chapter 1 home spot is gone after Chapter 1 — meditate there first; keep a chapter-start save. (PowerPyx, GTABase)</p>`
    : '';
  const guideSplit = trophy.guide.split('Sources: ');
  const guideBody = guideSplit[0];
  const guideSources = guideSplit.length > 1 ? `Sources: ${guideSplit.slice(1).join('Sources: ')}` : '';
  // The panel must show the guide AND its sources inside one 800px frame,
  // so show the guide's opening (what to do, where/how) and the full source
  // line; the complete guide text lives in data/trophies.json.
  const guideBodyShown = guideBody.length > 200
    ? `${guideBody.slice(0, 200).replace(/\s[^.]*$/, '')} …`
    : guideBody;
  const unconfirmed = trophy.guide.includes('not yet confirmed')
    ? `<p class="g-warn"><b>Honest note:</b> no guide has confirmed this trophy's exact trigger yet — the guide below says what the description supports and what is still unknown, rather than guessing.</p>`
    : '';
  panelEl.innerHTML = `
    <p class="g-kind">${kindLabel}${trophy.kind.toUpperCase()} · STAGE ${trophy.stage} · GUIDE — IN OUR OWN WORDS</p>
    <h2>${masked ? 'Hidden story trophy' : trophy.name}</h2>
    <p class="g-desc">“${masked ? 'Hidden until earned.' : trophy.description}”</p>
    <div class="g-chips">${gradeChip(trophy)}${trophy.hidden ? '<span class="chip hidden">Hidden</span>' : ''}${trophy.missable ? '<span class="chip missable">Missable</span>' : ''}${trophy.count ? `<span class="chip count">×${trophy.count}</span>` : ''}</div>
    ${warn}${unconfirmed}
    <h3>Guide</h3>
    <p>${masked ? 'This is a hidden story trophy. Earn it in the game to reveal its name, description and guide here — the spoiler setting is hiding it until then.' : guideBodyShown}</p>
    ${masked ? '' : `<p class="g-sources">${guideSources}</p>`}
    <p class="g-earn"><span>${earnedIds.has(trophy.id) ? '✓ Earned — ticked in the checklist.' : 'Tick it in the checklist to save it here.'}</span></p>`;
  // (Earned state is toggled from the checklist checkbox, which re-renders this panel.)
}

function renderAll() {
  renderProgressCard();
  renderRoadmapStrip();
  renderRoadmapCards();
  renderChecklist();
  renderGuidePanel();
}

searchBox.addEventListener('input', () => { viewState.query = searchBox.value; renderChecklist(); });
gradeSelect.addEventListener('change', () => { viewState.grade = gradeSelect.value; renderChecklist(); });
spoilerToggle.addEventListener('change', () => { viewState.spoilersHidden = spoilerToggle.checked; renderAll(); });
for (const button of document.querySelectorAll('#kindFilters button')) {
  button.addEventListener('click', () => {
    viewState.kind = button.dataset.kind;
    for (const other of document.querySelectorAll('#kindFilters button')) other.classList.toggle('active', other === button);
    renderChecklist();
  });
}
document.getElementById('exportBtn').addEventListener('click', () => exportProgressToFile(earnedIds));
document.getElementById('importFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    earnedIds = await importProgressFromFile(file);
    saveEarnedSet(earnedIds);
    renderAll();
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  }
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Clear all earned ticks?')) return;
  earnedIds = new Set();
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
});
document.getElementById('openMissable').addEventListener('click', () => {
  selectedId = 28;
  renderChecklist();
  renderGuidePanel();
  panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

renderAll();
