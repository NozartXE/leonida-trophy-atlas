// Leonida Trophy Atlas — bootstrap: loads the trophy data, renders the
// checklist + open guide + progress card + roadmap, and wires the
// toolbar (search, kind/grade/stage filters, sort, spoiler toggle,
// export/import).
// The guide panel always renders the selected trophy's COMPLETE guide
// text and its full structured Sources list — nothing is truncated.
// Guides carry claim-level footnote markers [1], [2], ... keyed to the
// guide's own numbered Sources list, and the official description sits
// in its own box, separate from the own-words guide. While a guide is
// open, the roadmap mini-strip collapses and the missable banner
// compacts, so the guide owns the frame; closing the guide (its Close
// button) brings the strip and full banner back.
import {
  COUNTERS_KEY, STORAGE_KEY, applyDemoStateIfRequested, counterValueFor,
  exportProgressToFile, importProgressFromFile, loadCounters, loadEarnedSet,
  saveCounters, saveEarnedSet,
} from './state.js';
import { applyTrophyFilters, displayDescriptionFor, displayNameFor, filterHintFor, isMethodUnknown, isStorySpoiler } from './filters.js';
import { PSN_POINTS, ROADMAP_FACTS, ROADMAP_STAGES, platinumProgress, psnPoints, stageProgress, trophiesInStage } from './roadmap.js';

const params = new URLSearchParams(location.search);
const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const byId = new Map(trophies.map((trophy) => [trophy.id, trophy]));
// The 7 trophies whose unlock method no guide has confirmed yet.
const UNKNOWN_IDS = trophies.filter(isMethodUnknown).map((trophy) => trophy.id);
const FLAGGED_ID = 28; // Positive Mental Attitude — the one flagged missable.

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
  stage: params.get('stage') ?? 'all',
  sort: params.get('sort') ?? 'roadmap',
  spoilersHidden: params.get('spoiler') === 'off' ? false : true,
};
const view = params.get('view') ?? 'checklist';

const listEl = document.getElementById('trophyList');
const panelEl = document.getElementById('guidePanel');
const searchBox = document.getElementById('searchBox');
const gradeSelect = document.getElementById('gradeSelect');
const stageSelect = document.getElementById('stageSelect');
const sortSelect = document.getElementById('sortSelect');
const spoilerToggle = document.getElementById('spoilerToggle');

if (view === 'roadmap') document.body.classList.add('view-roadmap');
if (view === 'missables') document.body.classList.add('view-missables');
searchBox.value = viewState.query;
gradeSelect.value = viewState.grade;
stageSelect.value = viewState.stage;
sortSelect.value = viewState.sort;
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

// Footnote markers [n] in guide prose render as small raised refs.
function markFootnotes(text) {
  return escapeHtml(text).replace(/\[(\d+)\]/g, '<sup class="g-foot">[$1]</sup>');
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

// Compact labelled counter text, e.g. "spots 9/18", "locations 42/100",
// "laundered $0k/$250k", "completion 0%" — used in rows, stage cards, the
// NEXT UP banner and the missables table, always from live tracker state.
// The unit comes from the trophy's own guide wording (counter.label in the
// data); no counter is ever shown as a bare number.
function counterText(trophy) {
  const value = counterValueFor(counters, trophy);
  const label = trophy.counter.label;
  if (trophy.counter.money) return `${label} $${Math.round(value / 1000)}k/$${Math.round(trophy.counter.target / 1000)}k`;
  if (trophy.counter.percent) return `${label} ${value}%`;
  return `${label} ${value}/${trophy.counter.target}`;
}

// Compact in-row progress for counter trophies, e.g. 9/18 or 42/100.
function counterChip(trophy) {
  return `<span class="chip count">${counterText(trophy)}</span>`;
}

// Earliest incomplete stage, missable first: while Chapter 1 is
// incomplete that is Positive Mental Attitude; afterwards the first
// unearned trophy of the earliest unfinished stage.
function nextUp() {
  for (const stage of ROADMAP_STAGES) {
    const stageTrophies = trophiesInStage(trophies, stage.stage);
    const open = stageTrophies.filter((trophy) => !earnedIds.has(trophy.id));
    if (open.length === 0) continue;
    const flagged = open.find((trophy) => trophy.missable);
    return { trophy: flagged ?? open[0], stage: stage.stage };
  }
  return null;
}

function guideHref(trophyId) {
  const next = new URLSearchParams(params);
  next.delete('view');
  next.set('select', String(trophyId));
  return `?${next.toString()}`;
}

function renderKindCounts() {
  const counts = {
    all: trophies.length,
    story: trophies.filter((t) => t.kind === 'story').length,
    missable: trophies.filter((t) => t.missable).length + UNKNOWN_IDS.length,
    collectibles: trophies.filter((t) => t.kind === 'collectibles').length,
    activities: trophies.filter((t) => t.kind === 'activities').length,
    online: trophies.filter((t) => t.kind === 'online').length,
  };
  const labels = { all: 'All', story: 'Story', collectibles: 'Collectibles', activities: 'Activities', online: 'Online' };
  for (const button of document.querySelectorAll('#kindFilters button')) {
    const kind = button.dataset.kind;
    if (kind === 'missable') button.textContent = 'Missable 1 · Unknown 7';
    else button.textContent = `${labels[kind]} ${counts[kind]}`;
    button.classList.toggle('empty', kind === 'online');
  }
}

// Stage chips in the audit strip, synced to earned state: S1 3/13, ...
function renderAuditStages() {
  const wrap = document.getElementById('auditStages');
  if (!wrap) return;
  wrap.innerHTML = ROADMAP_STAGES.map((stage) => {
    const p = stageProgress(trophies, earnedIds, stage.stage);
    return `<span class="audit-stage">S${stage.stage} ${p.earned}/${p.total}</span>`;
  }).join('');
}

function renderProgressCard() {
  const progress = platinumProgress(trophies, earnedIds);
  document.getElementById('progressCount').textContent = `${progress.earned}/${progress.total}`;
  document.getElementById('progressPct').textContent = `${progress.percent}% to platinum`;
  document.getElementById('progressFill').style.width = `${progress.percent}%`;
  const g = progress.perGrade;
  document.getElementById('progressGrades').textContent =
    `Platinum ${g.platinum.earned}/${g.platinum.total} · Gold ${g.gold.earned}/${g.gold.total} · Silver ${g.silver.earned}/${g.silver.total} · Bronze ${g.bronze.earned}/${g.bronze.total}`;
  const psn = psnPoints(trophies, earnedIds);
  document.getElementById('progressPsn').textContent =
    `PSN points ${psn.points.toLocaleString('en-US')}/${psn.total.toLocaleString('en-US')} · Bronze ${PSN_POINTS.bronze} · Silver ${PSN_POINTS.silver} · Gold ${PSN_POINTS.gold} · Platinum ${PSN_POINTS.platinum}`;
  const up = nextUp();
  const upText = up ? `Next up: ${up.trophy.name}${up.trophy.counter ? ` — ${counterText(up.trophy)}` : ''}` : '';
  document.getElementById('progressNote').textContent =
    progress.earned === 0 ? 'Tick a trophy off and it stays ticked — saved in this browser.' :
    progress.earned === progress.total ? 'Platinum earned — Vice Got a Price! You are a Leonida Legend.' :
    `${progress.total - progress.earned} to go · ${upText}`;
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

function renderNextUp() {
  const banner = document.getElementById('nextUpBanner');
  if (!banner) return;
  const up = nextUp();
  if (!up) {
    banner.innerHTML = '<b>NEXT UP —</b> <span>Platinum earned. Every trophy is ticked.</span>';
    return;
  }
  const trophy = up.trophy;
  banner.innerHTML = `<b>NEXT UP — Stage ${up.stage}:</b> <span><b>${escapeHtml(trophy.name)}</b>${trophy.missable ? ' — meditate at the Chapter 1 home spot before the chapter ends' : ''}${trophy.counter ? ` · ${counterText(trophy)}` : ''}</span> <a href="${guideHref(trophy.id)}">Open its guide &rarr;</a>`;
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
    // Compact cards: title, earned/total, one-line blurb and the stage's
    // labelled counters. The per-trophy names live in the citation matrix
    // below (same frame, stage-badged) — a 55-row matrix and full name
    // lists cannot both fit in 800px, and the matrix is the denser
    // evidence. Cards size to content (see CSS align-items: start), so
    // no card carries the ~50% dead space of the equal-height grid.
    const countersLine = stageTrophies.filter((trophy) => trophy.counter)
      .map((trophy) => counterText(trophy)).join(' · ');
    card.innerHTML = `<h3>${stage.title}</h3><p class="stage-count">${p.earned}/${p.total} earned · ${stage.hours} est.</p><p class="stage-count stage-blurb">${stage.blurb}</p><p class="stage-counters">Counters: ${countersLine}</p>`;
    cards.append(card);
  }
}

// The list source that publishes a guide's official description — the
// same rule the guide panel's OFFICIAL DESCRIPTION box uses for its
// footnote, so the matrix counts and the panel agree.
function listSourceFor(trophy) {
  const listIdx = trophy.sources.findIndex((s) => s.name === 'Exophase');
  return listIdx === -1 ? trophy.sources.find((s) => s.name === 'PSNProfiles') : trophy.sources[listIdx];
}

// Per-guide, per-source citation counts, computed from the guide's own
// footnote markers — never typed in. A marker [n] counts for the guide's
// nth source; the official-description citation counts once for the list
// source. The four columns are the only sources any guide consults.
function citationCounts(trophy) {
  const counts = { PowerPyx: 0, GTABase: 0, Exophase: 0, PSNProfiles: 0 };
  for (const m of trophy.guide.matchAll(/\[(\d+)\]/g)) {
    const src = trophy.sources[Number(m[1]) - 1];
    if (src && src.name in counts) counts[src.name] += 1;
  }
  const list = listSourceFor(trophy);
  if (list) counts[list.name] += 1;
  return counts;
}

// Flags derived from the data only. OPEN = the 7 method-unknown guides.
// 1-SRC = only one source backs the method (body markers cite a single
// distinct source). DIFFER is never invented: no guide records a
// disagreement, so no DIFFER flag is shown anywhere.
function citationFlag(trophy) {
  if (isMethodUnknown(trophy)) return 'OPEN';
  const bodySources = new Set([...trophy.guide.matchAll(/\[(\d+)\]/g)]
    .map((m) => trophy.sources[Number(m[1]) - 1]?.name).filter(Boolean));
  if (bodySources.size === 1) return '1-SRC';
  return '';
}

function renderMatrix() {
  const wrap = document.getElementById('citationMatrix');
  if (!wrap) return;
  const ordered = [...trophies].sort((a, b) => a.stage - b.stage || a.id - b.id);
  const rows = ordered.map((trophy) => ({
    trophy,
    counts: citationCounts(trophy),
    flag: citationFlag(trophy),
    masked: isStorySpoiler(trophy, earnedIds, viewState.spoilersHidden),
  }));
  const sources = ['PowerPyx', 'GTABase', 'Exophase', 'PSNProfiles'];
  const totals = {};
  let bodyMarkers = 0;
  let bodyResolved = 0;
  for (const trophy of trophies) {
    for (const m of trophy.guide.matchAll(/\[(\d+)\]/g)) {
      bodyMarkers += 1;
      if (Number(m[1]) <= trophy.sources.length) bodyResolved += 1;
    }
  }
  for (const source of sources) totals[source] = rows.reduce((sum, r) => sum + r.counts[source], 0);
  const totalCitations = Object.values(totals).reduce((a, b) => a + b, 0);
  const openCount = rows.filter((r) => r.flag === 'OPEN').length;
  const oneSrcCount = rows.filter((r) => r.flag === '1-SRC').length;
  const cols = [rows.slice(0, 19), rows.slice(19, 37), rows.slice(37)];
  const colHtml = cols.map((col) => {
    const body = col.map(({ trophy, counts, flag, masked }) => {
      const name = masked ? displayNameFor(trophy, earnedIds, viewState.spoilersHidden) : escapeHtml(trophy.name);
      return `<tr class="${earnedIds.has(trophy.id) ? 'earned' : ''}"><td class="m-stage">S${trophy.stage}</td><td class="m-name">${earnedIds.has(trophy.id) ? '✓ ' : ''}${name}</td>${sources.map((s) => `<td class="m-count${counts[s] === 0 ? ' zero' : ''}">${counts[s]}</td>`).join('')}<td class="m-flag${flag ? ` ${flag.toLowerCase()}` : ''}">${flag || '—'}</td></tr>`;
    }).join('');
    return `<table class="matrix"><thead><tr><th></th><th>Guide</th>${['Pyx', 'GTAB', 'Exo', 'PSNP'].map((s, i) => `<th title="${sources[i]}">${s}</th>`).join('')}<th>Flag</th></tr></thead><tbody>${body}</tbody></table>`;
  }).join('');
  wrap.innerHTML = `<h3>Citation matrix — every guide's sources, counted from its own footnotes</h3>
    <p class="matrix-summary">${rows.length} guides · ${totalCitations} citations (${sources.map((s) => `${s} ${totals[s]}`).join(' · ')}) · OPEN ${openCount} · 1-SRC ${oneSrcCount} · DIFFER 0 — no disagreement recorded in our guides</p>
    <div class="matrix-cols">${colHtml}</div>
    <p class="matrix-note">Columns: Pyx = PowerPyx, GTAB = GTABase, Exo = Exophase, PSNP = PSNProfiles. Counts are the footnote markers in each guide, plus the official-description citation (Exophase). PSNProfiles is a list source in 31 guides; no method step cites it. ${bodyResolved}/${bodyMarkers} body markers resolve.</p>`;
}

// Saved-state proof, computed at render from the live state: the storage
// keys, the byte size of the JSON this state serialises to, and the
// earned/counter counts. Export downloads the same JSON.
function renderSavedState() {
  const el = document.getElementById('savedState');
  if (!el) return;
  const earnedJson = JSON.stringify([...earnedIds].sort((a, b) => a - b));
  const countersJson = JSON.stringify(counters);
  el.innerHTML = `<b>SAVED STATE —</b> keys <code>${STORAGE_KEY}</code> + <code>${COUNTERS_KEY}</code> · ${earnedIds.size} earned · ${Object.keys(counters).length} counters · earned JSON ${earnedJson.length} B · counters JSON ${countersJson.length} B · Export downloads the same JSON.`;
}

function renderChecklist() {
  const shown = applyTrophyFilters(trophies, { ...viewState, counters });
  document.getElementById('listCount').textContent = `(${shown.length})`;
  let hint = filterHintFor(viewState.kind, viewState.grade, viewState.query, shown.length, trophies.length);
  if (viewState.stage !== 'all') hint += ` · stage ${viewState.stage}`;
  if (viewState.sort !== 'roadmap') hint += ` · sorted by ${viewState.sort === 'name' ? 'name' : viewState.sort === 'grade' ? 'grade' : 'counter progress'}`;
  document.getElementById('listHint').textContent = hint;
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
    const masked = isStorySpoiler(trophy, earnedIds, viewState.spoilersHidden);
    // Capped at grade + stage + counter + ONE status chip. The N-sources
    // chip is gone (the count lives in the guide panel) and so is the
    // kind chip (the name line carries it when masked). Status priority:
    // Missable > Unknown > REVEAL (masked) > Hidden (unmasked hidden).
    const chips = [gradeChip(trophy)];
    if (trophy.missable) chips.push('<span class="chip missable">Missable</span>');
    else if (isMethodUnknown(trophy)) chips.push('<span class="chip unknown">Unknown</span>');
    else if (masked) chips.push('<span class="chip reveal">Reveal &darr;</span>');
    else if (trophy.hidden) chips.push('<span class="chip hidden">Hidden</span>');
    chips.push(`<span class="chip stage">S${trophy.stage}</span>`);
    if (trophy.counter) chips.push(counterChip(trophy));
    // The open guide's official description is boxed in the panel; the
    // open row drops its subtitle so no sentence appears twice in the
    // same frame. Every other row keeps its description.
    const isOpen = trophy.id === selectedId && guideOpen;
    body.innerHTML = `<div class="t-name">${displayNameFor(trophy, earnedIds, viewState.spoilersHidden)}</div>` +
      (isOpen ? '' : `<div class="t-desc">${displayDescriptionFor(trophy, earnedIds, viewState.spoilersHidden, trophy.counter ? counterText(trophy) : null)}</div>`) +
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
// and how / Missable) into numbered steps. Nothing is shortened or
// summarised; footnote markers [n] are kept from the data.
function guideStepHtml(body) {
  const segments = body.split(/\s+(?=(?:What to do|Where and how|Missable):)/);
  return segments.map((segment, i) => {
    const colon = segment.indexOf(':');
    if (colon === -1) return `<p class="g-step">${markFootnotes(segment)}</p>`;
    return `<p class="g-step"><strong>Step ${i + 1} — ${escapeHtml(segment.slice(0, colon + 1))}</strong>${markFootnotes(segment.slice(colon + 1))}</p>`;
  }).join('');
}

function sourcesListHtml(trophy) {
  const items = trophy.sources.map((source, i) =>
    `<li><span class="g-src-n">[${i + 1}]</span> <b>${escapeHtml(source.name)}</b> — ${escapeHtml(source.domain)} — ${escapeHtml(source.detail)} · read ${escapeHtml(source.read)}</li>`,
  ).join('');
  return `<h3>Sources</h3><ol class="g-sources-list">${items}</ol>`;
}

function counterHtml(trophy) {
  const value = counterValueFor(counters, trophy);
  const reached = value >= trophy.counter.target;
  return `<div class="g-counter">
    <span class="g-counter-label">Your count</span>
    <button type="button" class="counter-btn" data-counter-step="-1" aria-label="Count down">−</button>
    <span class="g-counter-value">${trophy.counter.label} ${formatCounterValue(trophy, value)} / ${formatCounterTarget(trophy)}</span>
    <button type="button" class="counter-btn" data-counter-step="1" aria-label="Count up">+</button>
    <span class="g-counter-note">${reached ? 'Target reached — tick it earned in the checklist.' : 'Counted here, saved in this browser.'}</span>
  </div>`;
}

// The official description, boxed and separate from the own-words guide,
// with its own footnote to the list source that publishes it.
function officialDescriptionHtml(trophy, masked) {
  const list = listSourceFor(trophy);
  const n = list ? trophy.sources.indexOf(list) + 1 : 1;
  return `<div class="g-official"><span class="g-official-label">Official description</span> <span class="g-official-text">“${masked ? 'Hidden until earned.' : escapeHtml(trophy.description)}”</span>${masked ? '' : ` <sup class="g-foot">[${n}]</sup>`}</div>`;
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
  const unconfirmed = isMethodUnknown(trophy)
    ? `<p class="g-warn"><b>Not pinned down yet:</b> no guide has confirmed this trophy's exact trigger yet — the guide below says what the description supports and what is still unknown, rather than guessing.</p>`
    : '';
  // A masked guide's placeholder is varied from the same non-spoiler
  // metadata as the checklist rows (stage, kind, grade, counter).
  const maskedBlurb = masked
    ? `<p class="g-step">This is a hidden ${trophy.kind} trophy — Stage ${trophy.stage} · ${trophy.grade}${trophy.counter ? ` · ${counterText(trophy)}` : ''}${isMethodUnknown(trophy) ? ' · method unknown' : ''}. Earn it in the game to reveal its name, description and guide here — the spoiler setting is hiding it until then.</p>`
    : guideStepHtml(trophy.guide);
  panelEl.innerHTML = `
    <div class="g-head">
      <p class="g-kind">${kindLabel}${trophy.kind.toUpperCase()} · STAGE ${trophy.stage} · GUIDE</p>
      <button type="button" class="g-close" id="closeGuide">Close guide ×</button>
    </div>
    <h2>${masked ? displayNameFor(trophy, earnedIds, viewState.spoilersHidden) : escapeHtml(trophy.name)}</h2>
    ${officialDescriptionHtml(trophy, masked)}
    <div class="g-chips">${gradeChip(trophy)}${trophy.hidden ? '<span class="chip hidden">Hidden</span>' : ''}${trophy.missable ? '<span class="chip missable">Missable</span>' : ''}${isMethodUnknown(trophy) ? '<span class="chip unknown">Unknown</span>' : ''}${trophy.counter ? counterChip(trophy) : (trophy.count ? `<span class="chip count">×${trophy.count}</span>` : '')}</div>
    ${warn}${unconfirmed}
    <h3>Guide — in our own words</h3>
    ${maskedBlurb}
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

// Missables page as a structured tracker: the flagged trophy as a row
// with its live counter and guide link, the 7 unknown-method trophies
// collapsed into ONE grouped block (seven names as chips, the shared
// verdict / point of no return / flagged-by stated once), and two WATCH
// rows where live entries disagree with our guides — the disagreement is
// shown, not settled: Strangers & Freaks (live #1 flags Yago's race
// time-sensitive; our guide follows PowerPyx/GTABase that strands stay
// open) and A Long Road (live entries state 100% before the final
// mission; our guide states no cutoff).
function renderMissablesTable() {
  const tbody = document.getElementById('missablesRows');
  if (!tbody) return;
  const flagged = byId.get(FLAGGED_ID);
  const strangers = byId.get(25);
  const longRoad = byId.get(14);
  const rows = [];
  rows.push(`<tr class="miss-flagged"><td><a href="${guideHref(flagged.id)}">${escapeHtml(flagged.name)}</a> <span class="chip missable">Missable</span> <span class="chip count">${counterText(flagged)}</span></td><td>Possibly missable</td><td>End of Chapter 1</td><td>PowerPyx + GTABase</td><td><a href="${guideHref(flagged.id)}">Open guide &rarr;</a></td></tr>`);
  const unknownChips = UNKNOWN_IDS.map((id) => `<a class="miss-chip" href="${guideHref(id)}">${escapeHtml(byId.get(id).name)}</a>`).join('');
  rows.push(`<tr class="miss-unknown"><td>${unknownChips}</td><td>Method not yet known</td><td>Not yet known</td><td>PowerPyx + GTABase</td><td><span class="miss-note">7 guides</span></td></tr>`);
  rows.push(`<tr class="miss-watch"><td><a href="${guideHref(strangers.id)}">${escapeHtml(strangers.name)}</a> <span class="chip watch">Watch</span> <span class="chip count">${counterText(strangers)}</span></td><td>Watch — time-sensitive, disputed</td><td>Yago's race, Ch. 3 — race it when it appears</td><td>Live #1 vs PowerPyx/GTABase</td><td><a href="${guideHref(strangers.id)}">Open guide &rarr;</a></td></tr>`);
  rows.push(`<tr class="miss-watch"><td><a href="${guideHref(longRoad.id)}">${escapeHtml(longRoad.name)}</a> <span class="chip watch">Watch</span> <span class="chip count">${counterText(longRoad)}</span></td><td>Watch — finish 100% before the finale</td><td>The final mission</td><td>Live #50 + live #1</td><td><a href="${guideHref(longRoad.id)}">Open guide &rarr;</a></td></tr>`);
  tbody.innerHTML = rows.join('');
}

function renderAll() {
  renderProgressCard();
  renderAuditStages();
  renderRoadmapStrip();
  renderNextUp();
  renderRoadmapFacts();
  renderRoadmapCards();
  renderMatrix();
  renderSavedState();
  renderMissablesTable();
  renderChecklist();
  renderGuidePanel();
}

renderKindCounts();
renderRoadmapFacts();
searchBox.addEventListener('input', () => { viewState.query = searchBox.value; renderChecklist(); });
gradeSelect.addEventListener('change', () => { viewState.grade = gradeSelect.value; renderChecklist(); });
stageSelect.addEventListener('change', () => { viewState.stage = stageSelect.value; renderChecklist(); });
sortSelect.addEventListener('change', () => { viewState.sort = sortSelect.value; renderChecklist(); });
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
