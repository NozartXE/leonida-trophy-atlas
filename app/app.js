// Leonida Trophy Atlas — bootstrap: loads the trophy data, renders the
// checklist + open guide + progress card + roadmap, and wires the
// toolbar (search, kind/grade filters, spoiler toggle, export/import).
// The guide panel always renders the selected trophy's COMPLETE guide
// text and its full structured Sources list — nothing is truncated.
// While a guide is open, the roadmap mini-strip collapses and the
// missable banner compacts, so the guide owns the frame; closing the
// guide (its Close button) brings the strip and full banner back.
import {
  COUNTERS_KEY, STORAGE_KEY, applyDemoStateIfRequested, counterValueFor,
  exportProgressToFile, importProgressFromFile, loadCounters, loadEarnedSet,
  saveCounters, saveEarnedSet,
} from './state.js';
import { applyTrophyFilters, displayDescriptionFor, displayNameFor, filterHintFor, isStorySpoiler } from './filters.js';
import { ROADMAP_FACTS, ROADMAP_STAGES, platinumProgress, stageProgress, trophiesInStage } from './roadmap.js';

const params = new URLSearchParams(location.search);
const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const byId = new Map(trophies.map((trophy) => [trophy.id, trophy]));

let earnedIds = loadEarnedSet();
let counters = loadCounters();
({ earnedIds, counters } = applyDemoStateIfRequested(earnedIds, counters));
let selectedId = Number(params.get('select')) || 28;
if (!byId.has(selectedId)) selectedId = 28;
let guideOpen = true;

const viewState = {
  query: params.get('q') ?? '',
  kind: params.get('kind') ?? 'all',
  grade: params.get('grade') ?? 'all',
  spoilersHidden: params.get('spoiler') === 'off' ? false : true,
};
const view = params.get('view') ?? 'checklist';

const listEl = document.getElementById('trophyList');
const panelEl = document.getElementById('guidePanel');
const searchBox = document.getElementById('searchBox');
const gradeSelect = document.getElementById('gradeSelect');
const spoilerToggle = document.getElementById('spoilerToggle');

if (view === 'roadmap') document.body.classList.add('view-roadmap');
if (view === 'missables') document.body.classList.add('view-missables');
searchBox.value = viewState.query;
gradeSelect.value = viewState.grade;
spoilerToggle.checked = viewState.spoilersHidden;
for (const button of document.querySelectorAll('#kindFilters button')) {
  button.classList.toggle('active', button.dataset.kind === viewState.kind);
}
// View links keep the current state (demo seed, filters) and just switch view.
for (const link of document.querySelectorAll('[data-view-link]')) {
  const target = link.dataset.viewLink;
  const next = new URLSearchParams(params);
  if (target === 'checklist') next.delete('view'); else next.set('view', target);
  const qs = next.toString();
  link.setAttribute('href', qs ? `?${qs}` : './');
  link.classList.toggle('active', target === view || (target === 'checklist' && view !== 'roadmap' && view !== 'missables'));
}

function gradeChip(trophy) {
  return `<span class="chip ${trophy.grade}">${trophy.grade}</span>`;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatCounterValue(trophy, value) {
  if (trophy.counter?.money) return `$${value.toLocaleString('en-US')}`;
  return `${value}`;
}

function formatCounterTarget(trophy) {
  if (trophy.counter?.money) return `$${trophy.counter.target.toLocaleString('en-US')}`;
  if (trophy.counter?.percent) return `${trophy.counter.target}%`;
  return `${trophy.counter.target}`;
}

// Compact in-row progress for counter trophies, e.g. 9/18 or 42/100.
function counterChip(trophy) {
  const value = counterValueFor(counters, trophy);
  if (trophy.counter.money) {
    return `<span class="chip count">$${Math.round(value / 1000)}k/$${Math.round(trophy.counter.target / 1000)}k</span>`;
  }
  if (trophy.counter.percent) return `<span class="chip count">${value}% done</span>`;
  return `<span class="chip count">${value}/${trophy.counter.target}</span>`;
}

function renderKindCounts() {
  const counts = {
    all: trophies.length,
    story: trophies.filter((t) => t.kind === 'story').length,
    missable: trophies.filter((t) => t.missable).length,
    collectibles: trophies.filter((t) => t.kind === 'collectibles').length,
    activities: trophies.filter((t) => t.kind === 'activities').length,
    online: trophies.filter((t) => t.kind === 'online').length,
  };
  const labels = { all: 'All', story: 'Story', missable: 'Missable', collectibles: 'Collectibles', activities: 'Activities', online: 'Online' };
  for (const button of document.querySelectorAll('#kindFilters button')) {
    const kind = button.dataset.kind;
    button.textContent = `${labels[kind]} ${counts[kind]}`;
  }
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
  return ROADMAP_STAGES.length;
}

function renderRoadmapStrip() {
  const strip = document.getElementById('roadmapStrip');
  strip.replaceChildren();
  for (const stage of ROADMAP_STAGES) {
    const p = stageProgress(trophies, earnedIds, stage.stage);
    const div = document.createElement('div');
    div.className = 'stage';
    div.innerHTML = `<b>${stage.title}</b><span class="n">${p.earned}/${p.total} earned · ${stage.hours} est.</span>`;
    strip.append(div);
  }
}

function renderRoadmapFacts() {
  const facts = document.getElementById('roadmapFacts');
  const items = [ROADMAP_FACTS.totalHours, ROADMAP_FACTS.difficulty, ROADMAP_FACTS.playthroughs, ROADMAP_FACTS.replay, ROADMAP_FACTS.saves, ROADMAP_FACTS.cheats];
  facts.innerHTML = items.map((item) => `<span class="fact">${item}</span>`).join('') +
    `<p class="roadmap-facts-note">${ROADMAP_FACTS.note}</p>`;
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
    card.innerHTML = `<h3>${stage.title}</h3><p class="stage-count">${p.earned}/${p.total} earned · ${stage.hours} est.</p><p class="stage-count stage-blurb">${stage.blurb}</p><ul>${items}</ul>`;
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
    li.className = (earnedIds.has(trophy.id) ? 'earned' : '') + (trophy.id === selectedId && guideOpen ? ' selected' : '');
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
    if (trophy.counter) chips.push(counterChip(trophy));
    else if (trophy.count) chips.push(`<span class="chip count">×${trophy.count}</span>`);
    body.innerHTML = `<div class="t-name">${displayNameFor(trophy, earnedIds, viewState.spoilersHidden)}</div>` +
      `<div class="t-desc">${displayDescriptionFor(trophy, earnedIds, viewState.spoilersHidden)}</div>` +
      `<div class="t-meta">${chips.join('')}</div>`;
    li.append(box, body);
    li.addEventListener('click', (event) => {
      if (event.target === box) return;
      selectedId = trophy.id;
      guideOpen = true;
      renderChecklist();
      renderGuidePanel();
    });
    listEl.append(li);
  }
}

// The complete guide body, split at its own lead-ins (What to do / Where
// and how / Missable) into steps. Nothing is shortened or summarised.
function guideStepHtml(body) {
  const segments = escapeHtml(body).split(/\s+(?=(?:What to do|Where and how|Missable):)/);
  return segments.map((segment) => {
    const colon = segment.indexOf(':');
    if (colon === -1) return `<p class="g-step">${segment}</p>`;
    return `<p class="g-step"><strong>${segment.slice(0, colon + 1)}</strong>${segment.slice(colon + 1)}</p>`;
  }).join('');
}

function sourcesListHtml(trophy) {
  const items = trophy.sources.map((source) =>
    `<li><b>${escapeHtml(source.name)}</b> — ${escapeHtml(source.domain)} — ${escapeHtml(source.detail)} · read ${escapeHtml(source.read)}</li>`,
  ).join('');
  return `<h3>Sources</h3><ul class="g-sources-list">${items}</ul>`;
}

function counterHtml(trophy) {
  const value = counterValueFor(counters, trophy);
  const reached = value >= trophy.counter.target;
  return `<div class="g-counter">
    <span class="g-counter-label">Your count</span>
    <button type="button" class="counter-btn" data-counter-step="-1" aria-label="Count down">−</button>
    <span class="g-counter-value">${formatCounterValue(trophy, value)} / ${formatCounterTarget(trophy)}</span>
    <button type="button" class="counter-btn" data-counter-step="1" aria-label="Count up">+</button>
    <span class="g-counter-note">${reached ? 'Target reached — tick it earned in the checklist.' : 'Counted here, saved in this browser.'}</span>
  </div>`;
}

function renderGuidePanel() {
  document.body.classList.toggle('guide-open', guideOpen);
  if (!guideOpen) {
    panelEl.innerHTML = `<p class="g-kind">GUIDE CLOSED</p>
      <p class="g-closed">Pick any trophy in the checklist to read its full guide here — the whole text, its counter and its sources. While a guide is open, the roadmap strip above collapses so the guide has the frame to itself.</p>`;
    return;
  }
  const trophy = byId.get(selectedId);
  const masked = isStorySpoiler(trophy, earnedIds, viewState.spoilersHidden);
  const kindLabel = trophy.missable ? 'MISSABLE · ' : '';
  const warn = trophy.missable
    ? `<p class="g-warn"><b>⚠ Missable:</b> the Chapter 1 home spot is gone after Chapter 1 — meditate there first; keep a chapter-start save. (PowerPyx, GTABase)</p>`
    : '';
  const fullText = `${trophy.guide} ${trophy.sources.map((s) => s.detail).join(' ')}`;
  const unconfirmed = /not yet confirmed|unconfirmed|under investigation/.test(fullText)
    ? `<p class="g-warn"><b>Honest note:</b> no guide has confirmed this trophy's exact trigger yet — the guide below says what the description supports and what is still unknown, rather than guessing.</p>`
    : '';
  panelEl.innerHTML = `
    <div class="g-head">
      <p class="g-kind">${kindLabel}${trophy.kind.toUpperCase()} · STAGE ${trophy.stage} · GUIDE</p>
      <button type="button" class="g-close" id="closeGuide">Close guide ×</button>
    </div>
    <h2>${masked ? 'Hidden story trophy' : escapeHtml(trophy.name)}</h2>
    <p class="g-desc">“${masked ? 'Hidden until earned.' : escapeHtml(trophy.description)}”</p>
    <div class="g-chips">${gradeChip(trophy)}${trophy.hidden ? '<span class="chip hidden">Hidden</span>' : ''}${trophy.missable ? '<span class="chip missable">Missable</span>' : ''}${trophy.counter ? counterChip(trophy) : (trophy.count ? `<span class="chip count">×${trophy.count}</span>` : '')}</div>
    ${warn}${unconfirmed}
    <h3>Guide — in our own words</h3>
    ${masked ? '<p class="g-step">This is a hidden story trophy. Earn it in the game to reveal its name, description and guide here — the spoiler setting is hiding it until then.</p>' : guideStepHtml(trophy.guide)}
    ${masked || !trophy.counter ? '' : counterHtml(trophy)}
    ${masked ? '' : sourcesListHtml(trophy)}
    ${masked || trophy.counter ? '' : `<p class="g-earn"><span>${earnedIds.has(trophy.id) ? '✓ Earned — ticked in the checklist.' : 'Tick it in the checklist to save it here.'}</span></p>`}`;
  document.getElementById('closeGuide').addEventListener('click', () => {
    guideOpen = false;
    renderChecklist();
    renderGuidePanel();
  });
  for (const button of panelEl.querySelectorAll('[data-counter-step]')) {
    button.addEventListener('click', () => {
      const delta = Number(button.dataset.counterStep) * (trophy.counter.step ?? 1);
      const next = Math.min(trophy.counter.target, Math.max(0, counterValueFor(counters, trophy) + delta));
      counters[trophy.id] = next;
      saveCounters(counters);
      renderChecklist();
      renderGuidePanel();
    });
  }
}

function renderAll() {
  renderProgressCard();
  renderRoadmapStrip();
  renderRoadmapCards();
  renderChecklist();
  renderGuidePanel();
}

renderKindCounts();
renderRoadmapFacts();
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
document.getElementById('exportBtn').addEventListener('click', () => exportProgressToFile(earnedIds, counters));
document.getElementById('importFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = await importProgressFromFile(file);
    earnedIds = imported.earned;
    counters = imported.counters;
    saveEarnedSet(earnedIds);
    saveCounters(counters);
    renderAll();
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  }
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Clear all earned ticks and counters?')) return;
  earnedIds = new Set();
  counters = {};
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(COUNTERS_KEY);
  renderAll();
});
document.getElementById('openMissable').addEventListener('click', () => {
  selectedId = 28;
  guideOpen = true;
  renderChecklist();
  renderGuidePanel();
  panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

renderAll();
