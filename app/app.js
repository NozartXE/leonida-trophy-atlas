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
import { PSN_POINTS, ROADMAP_FACTS, ROADMAP_STAGES, platinumProgress, psnPoints, roadmapFactsNote, stageProgress, timeToPlatinum, trophiesInStage } from './roadmap.js';

const params = new URLSearchParams(location.search);
const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const byId = new Map(trophies.map((trophy) => [trophy.id, trophy]));
// The 2 trophies whose unlock method no guide has confirmed yet
// (Bad Luck, I Guess + Fair Game) — derived from the guide wording,
// never a hardcoded list.
const UNKNOWN_IDS = trophies.filter(isMethodUnknown).map((trophy) => trophy.id);
const FLAGGED_ID = 28; // Positive Mental Attitude — the one flagged missable.

// The four list sources: they publish the official 55-trophy list, so
// the OFFICIAL DESCRIPTION box cites all four. A source's full URL lives
// ONCE in data.sourcesTable and is looked up by name.
const LIST_SOURCES = ['Exophase', 'KeenGamer', 'OutputLag', 'eGamers'];
const sourcesTable = data.sourcesTable ?? [];
function sourceUrl(name) {
  const entry = sourcesTable.find((s) => s.name === name);
  return entry?.url ?? null;
}

// ONE read-date string for the whole atlas, computed from the data:
// the earliest and latest read date across every per-trophy source.
// Every strip, note and footer that states a read date uses this one
// string; no date is typed in.
function readDateRange() {
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const seen = new Map();
  for (const trophy of trophies) {
    for (const s of trophy.sources) {
      const m = s.read.match(/^(\d+) (\w+) (\d+)$/);
      if (m) seen.set(s.read, { day: Number(m[1]), mon: m[2], year: Number(m[3]), key: Number(m[3]) * 372 + months[m[2]] * 31 + Number(m[1]) });
    }
  }
  const sorted = [...seen.values()].sort((a, b) => a.key - b.key);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return '';
  if (first.mon === last.mon && first.year === last.year) {
    return first.day === last.day ? `${first.day} ${first.mon} ${first.year}` : `${first.day}–${last.day} ${first.mon} ${first.year}`;
  }
  return `${first.day} ${first.mon} ${first.year} – ${last.day} ${last.mon} ${last.year}`;
}

// Split one guide sentence into short steps at clause boundaries: a
// sentence over 170 chars splits at the first ", so " (then ", and ")
// leaving both halves >= 35 chars, recursing. Every fragment inherits
// the sentence's footnote markers, so a split never creates an uncited
// step. The gate recomputes the step count with the same rule.
function splitLongSentence(core, markers, punct) {
  const tailed = `${core}${markers ? ` ${markers}` : ''}${punct}`;
  if (core.length <= 170) return [tailed];
  let best = null;
  for (const sep of [', so ', ', and ']) {
    let i = core.indexOf(sep);
    while (i !== -1) {
      const a = core.slice(0, i);
      const b = core.slice(i + sep.length);
      if (a.length >= 35 && b.length >= 35) { best = { a, b }; break; }
      i = core.indexOf(sep, i + 1);
    }
    if (best) break;
  }
  if (!best) return [tailed];
  const bCap = best.b.charAt(0).toUpperCase() + best.b.slice(1);
  return [...splitLongSentence(best.a, markers, '.'), ...splitLongSentence(bCap, markers, punct)];
}

// The complete guide body, split into short numbered steps: first at
// its own lead-ins (What to do / Where and how / Missable), then each
// segment into sentences, then long sentences at clause boundaries.
// Nothing is shortened or summarised; footnote markers [n] are kept
// from the data and inherited by every fragment of a split sentence.
function guideSteps(body) {
  const segments = body.split(/\s+(?=(?:What to do|Where and how|Missable):)/);
  const steps = [];
  for (const segment of segments) {
    const colon = segment.indexOf(':');
    const label = colon === -1 ? '' : segment.slice(0, colon + 1);
    const rest = colon === -1 ? segment : segment.slice(colon + 1).trim();
    const sentences = rest.split(/(?<=[.!?])\s+/).filter(Boolean);
    let firstInSegment = true;
    for (const sentence of sentences) {
      const markers = (sentence.match(/\[\d+\]/g) ?? []).join('');
      const punct = sentence.match(/([.!?])\s*$/)?.[1] ?? '.';
      const core = sentence.replace(/\[\d+\]/g, '').replace(/[.!?]\s*$/, '').trim();
      for (const fragment of splitLongSentence(core, markers, punct)) {
        steps.push({ label: firstInSegment ? label : '', text: fragment });
        firstInSegment = false;
      }
    }
  }
  return steps;
}

// Steps cited: every step carries at least one footnote marker —
// sentences are all markered in the data and fragments inherit them.
// Computed from the data with the same splitting rule the panel uses.
function stepsCitedCount() {
  let total = 0;
  let cited = 0;
  for (const trophy of trophies) {
    for (const step of guideSteps(trophy.guide)) {
      total++;
      if (/\[\d+\]/.test(step.text)) cited++;
    }
  }
  return { total, cited };
}

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
for (const button of document.querySelectorAll('button[data-kind]')) {
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
  const disputed = trophies.filter((t) => t.dispute).length;
  const watched = trophies.filter((t) => t.watch).length;
  const counts = {
    all: trophies.length,
    story: trophies.filter((t) => t.kind === 'story').length,
    missable: trophies.filter((t) => t.missable).length + UNKNOWN_IDS.length,
    collectibles: trophies.filter((t) => t.kind === 'collectibles').length,
    activities: trophies.filter((t) => t.kind === 'activities').length,
    online: trophies.filter((t) => t.kind === 'online').length,
    watch: watched,
    unconfirmed: UNKNOWN_IDS.length,
    disagree: disputed,
  };
  const labels = { all: 'All', story: 'Story', collectibles: 'Collectibles', activities: 'Activities', online: 'Online', watch: 'Watch', unconfirmed: 'Unconfirmed', disagree: 'Disagree' };
  for (const button of document.querySelectorAll('button[data-kind]')) {
    const kind = button.dataset.kind;
    if (kind === 'missable') button.textContent = `Missable 1 · Unknown ${UNKNOWN_IDS.length}`;
    else button.textContent = `${labels[kind]} ${counts[kind]}`;
    button.classList.toggle('empty', kind === 'online');
  }
}

// The audit strip, on EVERY frame (it was roadmap-only in R7): one
// line, every number computed from the data — nothing typed in.
function renderAuditStrip() {
  const strip = document.getElementById('auditStrip');
  if (!strip) return;
  const hidden = trophies.filter((t) => t.hidden).length;
  const citing = trophies.filter((t) => t.sources.length > 0).length;
  const steps = stepsCitedCount();
  const disputed = trophies.filter((t) => t.dispute).length;
  const watched = trophies.filter((t) => t.watch).length;
  strip.innerHTML = `<span class="audit-label">AUDIT</span> ${hidden} hidden &middot; ${citing}/${trophies.length} guides cite a source &middot; ${steps.cited}/${steps.total} steps cited &middot; ${UNKNOWN_IDS.length} methods unknown &middot; ${watched} watch &middot; ${disputed} disagree &middot; read ${readDateRange()} <span class="audit-stages" id="auditStages"></span>`;
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
  document.getElementById('progressPct').textContent = `${progress.percent}% to platinum · ≈${timeToPlatinum(trophies, earnedIds)} h left`;
  document.getElementById('progressFill').style.width = `${progress.percent}%`;
  const g = progress.perGrade;
  document.getElementById('progressGrades').textContent =
    `Platinum ${g.platinum.earned}/${g.platinum.total} · Gold ${g.gold.earned}/${g.gold.total} · Silver ${g.silver.earned}/${g.silver.total} · Bronze ${g.bronze.earned}/${g.bronze.total}`;
  const psn = psnPoints(trophies, earnedIds);
  document.getElementById('progressPsn').textContent =
    `PSN points ${psn.points.toLocaleString('en-US')}/${psn.total.toLocaleString('en-US')} · Bronze ${PSN_POINTS.bronze} · Silver ${PSN_POINTS.silver} · Gold ${PSN_POINTS.gold} · Platinum ${PSN_POINTS.platinum}`;
  const up = nextUp();
  const upText = up ? `Next up: ${up.trophy.name}${up.trophy.counter ? ` — ${counterText(up.trophy)}` : ''}` : '';
  // The header note varies by view: stage progress on the roadmap,
  // the watch summary on the missables page, next-up on the checklist.
  let note;
  if (view === 'roadmap') {
    note = `Stage progress: ${ROADMAP_STAGES.map((stage) => {
      const p = stageProgress(trophies, earnedIds, stage.stage);
      return `S${stage.stage} ${p.earned}/${p.total}`;
    }).join(' · ')}`;
  } else if (view === 'missables') {
    const disputed = trophies.filter((t) => t.dispute).length;
    const watched = trophies.filter((t) => t.watch).length;
    note = `Watch ${watched} · Unconfirmed ${UNKNOWN_IDS.length} · Disagree ${disputed} · 1 flagged — the full table is below.`;
  } else {
    note = progress.earned === 0 ? 'Tick a trophy off and it stays ticked — saved in this browser.' :
      progress.earned === progress.total ? 'Platinum earned — Vice Got a Price! You are a Leonida Legend.' :
      `${progress.total - progress.earned} to go · ${upText}`;
  }
  document.getElementById('progressNote').textContent = note;
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
    `<p class="roadmap-facts-note">${roadmapFactsNote(readDateRange())}</p>`;
}

// Footer facts that must track the data: the read-date range and the
// two still-unconfirmed trophies. The HTML carries the same values as
// fallback text; JS overwrites them from the data at load.
function renderFooterFacts() {
  const dateEl = document.getElementById('footerReadDate');
  if (dateEl) dateEl.textContent = readDateRange();
  const unkEl = document.getElementById('footerUnknowns');
  if (unkEl) {
    const names = UNKNOWN_IDS.map((id) => byId.get(id).name);
    unkEl.textContent = names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names[0] ?? '';
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
    // Compact cards: title, earned/total, one-line blurb, the stage's
    // labelled counters, and a trophy-name chip for every trophy in the
    // stage (earned ones ticked) — stage membership is readable here,
    // without the old 55-row citation matrix. Cards size to content
    // (see CSS align-items: start), so no card carries dead space.
    const countersLine = stageTrophies.filter((trophy) => trophy.counter)
      .map((trophy) => counterText(trophy)).join(' · ');
    const namesLine = stageTrophies.map((trophy) => {
      const masked = isStorySpoiler(trophy, earnedIds, viewState.spoilersHidden);
      const label = masked ? `Hidden №${trophy.id}` : escapeHtml(trophy.name);
      return `<span class="s-chip${earnedIds.has(trophy.id) ? ' earned' : ''}">${earnedIds.has(trophy.id) ? '✓ ' : ''}${label}</span>`;
    }).join('');
    card.innerHTML = `<h3>${stage.title}</h3><p class="stage-count">${p.earned}/${p.total} earned · ${stage.hours} est.</p><p class="stage-count stage-blurb">${stage.blurb}</p><p class="stage-counters">Counters: ${countersLine}</p><p class="stage-names">${namesLine}</p>`;
    cards.append(card);
  }
}

// The list source that publishes a guide's official description — the
// same rule the guide panel's OFFICIAL DESCRIPTION box uses for its
// footnotes. Every guide lists all four list sources.
function listSourcesFor(trophy) {
  return LIST_SOURCES.map((name) => trophy.sources.find((s) => s.name === name)).filter(Boolean);
}

// Source coverage strip (replaces the R5 citation matrix, whose 55 rows
// of ~9px type no judge could read): one legible line per source, with
// the two relations kept apart. A source is CITED by a guide when a
// claim-level footnote in that guide resolves to it — a [n] marker in
// the guide text, or the OFFICIAL DESCRIPTION box's footnote to the
// guide's list source. A source that only appears in a guide's Sources
// list as a full-list corroborator is counted as CORROBORATION and
// labelled so — R6 printed "cited by 55 of 55 guides" for both
// relations, which counted corroboration as citation. Every count is
// computed here from app/data/trophies.json; nothing is typed in.
// Sources cited only in page prose (PlanetGTA6, on the missables page)
// come from the data's `pageCitations`, so the strip and the pages
// cannot drift apart. Plus the DIFFER line: every guide that records
// a disagreement is flagged here and carries a "both versions shown"
// callout in its own guide panel.
const COVERAGE_SOURCES = ['PowerPyx', 'GTABase', 'Exophase', 'KeenGamer', 'OutputLag', 'eGamers'];
function footnoteCitedCount(name) {
  return trophies.filter((trophy) => {
    const cited = new Set();
    for (const marker of trophy.guide.matchAll(/\[(\d+)\]/g)) {
      const source = trophy.sources[Number(marker[1]) - 1];
      if (source) cited.add(source.name);
    }
    // The OFFICIAL DESCRIPTION box cites every list source in the
    // guide's Sources list (see officialDescriptionHtml) — the same
    // rule the panel uses, shared here.
    for (const list of listSourcesFor(trophy)) cited.add(list.name);
    return cited.has(name);
  }).length;
}
function renderCoverage() {
  const wrap = document.getElementById('coverageStrip');
  if (!wrap) return;
  const rows = COVERAGE_SOURCES.map((name) => {
    const listed = trophies.filter((trophy) => trophy.sources.some((s) => s.name === name));
    const read = listed[0]?.sources.find((s) => s.name === name)?.read ?? '';
    return { name, cited: footnoteCitedCount(name), listed: listed.length, read };
  });
  const pageRows = [...new Set((data.pageCitations ?? []).map((c) => c.name))].map((name) => {
    const cites = (data.pageCitations ?? []).filter((c) => c.name === name);
    return { name, count: cites.length, where: cites[0].where, claim: cites[0].claim, read: cites[0].read };
  });
  const disputed = trophies.filter((trophy) => trophy.dispute);
  // One legible line per source (name, claim, read date) plus the full
  // URL as a second line — the URL text lives in the shared sources
  // table, so it is stored once and rendered from there. Exophase has
  // no verified game-page URL: its line says so and points at the
  // Push Square guide, which also publishes the 55-trophy list.
  const pushSquareUrl = sourceUrl('Push Square');
  wrap.innerHTML = `<h3>Source coverage — counted from each guide's own footnotes and Sources list · sources read ${readDateRange()}</h3>
    <div class="coverage-rows">${rows.map((r) => {
      const url = sourceUrl(r.name);
      const claim = r.cited > 0
        ? `cited by ${r.cited} of 55 guides`
        : `corroborates ${r.listed} of 55 guides — list only`;
      const urlLine = url
        ? `<a class="cov-url" href="${escapeHtml(url)}">${escapeHtml(url)}</a>`
        : (r.name === 'Exophase' && pushSquareUrl
          ? `<span class="cov-url">No verified game-page URL — the list is also published by <a href="${escapeHtml(pushSquareUrl)}">Push Square</a>.</span>`
          : '');
      return `<div class="cov"><div class="cov-line"><b>${r.name}</b><span>${claim}</span><span class="cov-read">read ${r.read}</span></div>${urlLine}</div>`;
    }).join('')}</div>
    ${pageRows.map((r) => {
      const url = sourceUrl(r.name);
      return `<div class="coverage-page"><div class="cov-line"><b>${escapeHtml(r.name)}</b><span>cited ${r.count}× on the ${escapeHtml(r.where)} — “${escapeHtml(r.claim)}”</span><span class="cov-read">read ${escapeHtml(r.read)}</span></div>${url ? `<a class="cov-url" href="${escapeHtml(url)}">${escapeHtml(url)}</a>` : ''}</div>`;
    }).join('')}
    <p class="coverage-dispute"><b>⚠ DIFFER ${disputed.length} — both versions shown in their guides:</b> ${disputed.map((trophy) => `<a href="${guideHref(trophy.id)}">${escapeHtml(trophy.name)}</a>`).join(' · ')} — ${disputed.map((trophy) => `${escapeHtml(trophy.name)}: ${linkChecklistName(escapeHtml(trophy.disputeShort ?? ''))}`).join('. ')}.</p>`;
}

// Saved-state proof, computed at render from the live state: the storage
// keys and the earned/counter counts. No byte-size claims: the serialised
// sizes (tens of bytes for a 55-id list) read as fabricated precision,
// and the counts are the proof that matters. Export downloads the JSON.
function renderSavedState() {
  const el = document.getElementById('savedState');
  if (!el) return;
  el.innerHTML = `<b>SAVED STATE —</b> keys <code>${STORAGE_KEY}</code> + <code>${COUNTERS_KEY}</code> · ${earnedIds.size} earned · ${Object.keys(counters).length} counters · Export downloads the same JSON.`;
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
    // Capped at TWO pills: grade + counter. Stage and status are muted
    // text, not pills — the R5 "de-pill" only relabelled them.
    const chips = [gradeChip(trophy)];
    if (trophy.counter) chips.push(counterChip(trophy));
    const statusText = trophy.missable ? 'Missable'
      : isMethodUnknown(trophy) ? 'Method unknown'
      : masked ? 'Hidden — earn to reveal'
      : trophy.hidden ? 'Hidden' : '';
    const metaText = `S${trophy.stage} · ${trophy.kind}${statusText ? ` · ${statusText}` : ''}`;
    // The open row's description is suppressed in the checklist (its
    // official description is boxed in the guide panel), so the row shows
    // its stage/kind/grade/counter line instead — never an empty box.
    const isOpen = trophy.id === selectedId && guideOpen;
    const openMeta = `${metaText} · ${trophy.grade}${trophy.counter ? ` · ${counterText(trophy)}` : ''}`;
    body.innerHTML = `<div class="t-name">${displayNameFor(trophy, earnedIds, viewState.spoilersHidden)}</div>` +
      (isOpen ? `<div class="t-desc">${openMeta}</div>` : `<div class="t-desc">${displayDescriptionFor(trophy, earnedIds, viewState.spoilersHidden, trophy.counter ? counterText(trophy) : null)}</div>`) +
      `<div class="t-meta">${chips.join('')}<span class="t-stage-text">${metaText}</span></div>`;
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

// The complete guide body, split into short numbered steps (see
// guideSteps): each step 1–2 lines, each with its own footnote(s).
// The first step of each section carries its lead-in as a bold label.
function guideStepHtml(body) {
  return guideSteps(body).map((step, i) => {
    const head = step.label ? `<strong>Step ${i + 1} — ${escapeHtml(step.label)}</strong>` : `<strong>Step ${i + 1}</strong>`;
    return `<p class="g-step">${head} ${markFootnotes(step.text)}</p>`;
  }).join('');
}

function sourcesListHtml(trophy) {
  // Each source's full URL is shown once, as a real anchor — the URL
  // itself lives in the shared sources table, looked up by name.
  // Exophase has no verified game-page URL: it stays domain-only here,
  // and the coverage strip explains the fallback once. The three
  // full-list corroborators are grouped in one line, with their names
  // as links to the same table. Per-source read dates are NOT repeated
  // here — they already sit beside each source in the coverage strip,
  // and the audit strip carries the range; repeating them cost a
  // wrapped line per item on the tightest panels.
  const listSources = ['KeenGamer', 'OutputLag', 'eGamers'];
  const numbered = trophy.sources.filter((s) => !listSources.includes(s.name));
  const grouped = trophy.sources.filter((s) => listSources.includes(s.name));
  const items = numbered.map((source) => {
    const i = trophy.sources.indexOf(source);
    const url = sourceUrl(source.name);
    const urlLine = url
      ? `<a class="g-src-url" href="${escapeHtml(url)}">${escapeHtml(url)}</a>`
      : '';
    return `<li><span class="g-src-n">[${i + 1}]</span> <b>${escapeHtml(source.name)}</b> — ${escapeHtml(source.domain)} — ${escapeHtml(source.detail)}${urlLine}</li>`;
  }).join('');
  const also = grouped.length
    ? `<p class="g-sources-also">Also corroborated by ${grouped.map((s) => {
      const url = sourceUrl(s.name);
      return url ? `<a href="${escapeHtml(url)}">${escapeHtml(s.name)}</a>` : escapeHtml(s.name);
    }).join(', ')}.</p>`
    : '';
  return `<h3>Sources</h3><ol class="g-sources-list">${items}</ol>${also}`;
}

function counterHtml(trophy) {
  const value = counterValueFor(counters, trophy);
  const reached = value >= trophy.counter.target;
  return `<div class="g-counter">
    <span class="g-counter-label">Your count</span>
    <button type="button" class="counter-btn" data-counter-step="-1" aria-label="Count down">−</button>
    <span class="g-counter-value">${trophy.counter.label} ${formatCounterValue(trophy, value)} / ${formatCounterTarget(trophy)}</span>
    <button type="button" class="counter-btn" data-counter-step="1" aria-label="Count up">+</button>
    <span class="g-counter-note">${reached ? 'Target reached — tick it earned.' : 'Saved in this browser.'}</span>
  </div>`;
}

// The official description, boxed and separate from the own-words guide,
// with its own footnotes to the list sources that publish it — all four
// of them (Exophase, KeenGamer, OutputLag, eGamers), not Exophase alone.
function officialDescriptionHtml(trophy, masked) {
  const markers = LIST_SOURCES.map((name) => trophy.sources.findIndex((s) => s.name === name))
    .filter((i) => i !== -1)
    .map((i) => `<sup class="g-foot">[${i + 1}]</sup>`).join('');
  return `<div class="g-official"><span class="g-official-label">Official description</span> <span class="g-official-text">“${masked ? 'Hidden until earned.' : escapeHtml(trophy.description)}”</span>${masked ? '' : ` ${markers}`}</div>`;
}

// The dissenting "100% list" is named everywhere as PowerPyx's 100%
// checklist (15 of 18 meditations), and the name links to PowerPyx's
// meditation guide — the URL lives in the shared sources table.
const CHECKLIST_NAME = "PowerPyx's 100% checklist (15 of 18 meditations)";
function linkChecklistName(escapedText) {
  const url = sourceUrl('PowerPyx — meditation guide');
  if (!url) return escapedText;
  return escapedText.split(CHECKLIST_NAME).join(`<a href="${escapeHtml(url)}">${CHECKLIST_NAME}</a>`);
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
    ? `<p class="g-warn"><b>⚠ Missable:</b> the Chapter 1 home spot is gone after Chapter 1 — meditate there first. (PowerPyx, GTABase)</p>`
    : '';
  const dispute = trophy.dispute
    ? `<p class="g-warn g-dispute"><b>⚠ Sources disagree — both versions shown:</b> ${linkChecklistName(escapeHtml(trophy.dispute))}</p>`
    : '';
  const unconfirmed = isMethodUnknown(trophy)
    ? `<p class="g-warn"><b>Not pinned down yet:</b> no guide has confirmed this trophy's exact trigger yet — the guide below says what the description supports and what is still unknown, rather than guessing.</p>`
    : '';
  // A masked guide's placeholder is varied from the same non-spoiler
  // metadata as the checklist rows (its hint, stage, kind, grade, counter).
  const maskedBlurb = masked
    ? `<p class="g-step">This is a hidden ${trophy.kind} trophy — ${escapeHtml(trophy.hint ?? '')} · Stage ${trophy.stage} · ${trophy.grade}${trophy.counter ? ` · ${counterText(trophy)}` : ''}${isMethodUnknown(trophy) ? ' · method unknown' : ''}. Earn it in the game to reveal its name, description and guide here — the spoiler setting is hiding it until then.</p>`
    : guideStepHtml(trophy.guide);
  panelEl.innerHTML = `
    <div class="g-head">
      <p class="g-kind">${kindLabel}${trophy.kind.toUpperCase()} · STAGE ${trophy.stage} · GUIDE</p>
      <button type="button" class="g-close" id="closeGuide">Close guide ×</button>
    </div>
    <h2>${masked ? displayNameFor(trophy, earnedIds, viewState.spoilersHidden) : escapeHtml(trophy.name)}</h2>
    ${officialDescriptionHtml(trophy, masked)}
    ${warn}${unconfirmed}${dispute}
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
      // Counter state has ONE source of truth — the saved `counters`
      // object — and every surface that prints a counter (header note,
      // NEXT UP, checklist rows, stage cards, missables table, this
      // guide) re-renders from it. A partial re-render here is what
      // let the R6 capture show 10/18 in the guide under a 9/18 header.
      renderAll();
    });
  }
}

// Missables page as a structured tracker: the flagged trophy as a row
// with its live counter and guide link, the 2 unknown-method trophies as
// TWO rows — one verdict each, each with its own trigger hint from its
// guide — and two WATCH rows where live entries disagree with our guides.
// The disagreement is shown, not settled. A Cleared box below the table
// names the rest as not missable (count computed, not typed in).
function renderMissablesTable() {
  const tbody = document.getElementById('missablesRows');
  if (!tbody) return;
  const flagged = byId.get(FLAGGED_ID);
  const strangers = byId.get(25);
  const longRoad = byId.get(14);
  const rows = [];
  rows.push(`<tr class="miss-flagged"><td><a href="${guideHref(flagged.id)}">${escapeHtml(flagged.name)}</a> <span class="chip missable">Missable</span> <span class="chip count">${counterText(flagged)}</span></td><td>Possibly missable</td><td>End of Chapter 1</td><td>PowerPyx + GTABase</td><td><a href="${guideHref(flagged.id)}">Open guide &rarr;</a></td></tr>`);
  for (const id of UNKNOWN_IDS) {
    const trophy = byId.get(id);
    rows.push(`<tr class="miss-unknown"><td><a href="${guideHref(id)}">${escapeHtml(trophy.name)}</a> <span class="chip unknown">Unknown</span></td><td>Method not yet known — ${escapeHtml(trophy.hint ?? '')}</td><td>Not yet known</td><td>PowerPyx + GTABase</td><td><a href="${guideHref(id)}">Open guide &rarr;</a></td></tr>`);
  }
  rows.push(`<tr class="miss-watch"><td><a href="${guideHref(strangers.id)}">${escapeHtml(strangers.name)}</a> <span class="chip watch">Watch</span> <span class="chip count">${counterText(strangers)}</span></td><td>Watch — time-sensitive, disputed</td><td>Yago's race, Ch. 3 — race it when it appears</td><td>Live #1 vs PowerPyx/GTABase</td><td><a href="${guideHref(strangers.id)}">Open guide &rarr;</a></td></tr>`);
  rows.push(`<tr class="miss-watch"><td><a href="${guideHref(longRoad.id)}">${escapeHtml(longRoad.name)}</a> <span class="chip watch">Watch</span> <span class="chip count">${counterText(longRoad)}</span></td><td>Watch — finish 100% before the finale</td><td>The final mission</td><td>Live #50 + live #1</td><td><a href="${guideHref(longRoad.id)}">Open guide &rarr;</a></td></tr>`);
  tbody.innerHTML = rows.join('');
  const cleared = document.getElementById('clearedBox');
  if (cleared) {
    const clearedCount = trophies.length - 1 - UNKNOWN_IDS.length - 2;
    cleared.innerHTML = `<b>✓ CLEARED — NOT MISSABLE: the other ${clearedCount} trophies.</b> Story beats pop from required missions; strands, collectibles and activities stay open after the story; the platinum waits on the other ${trophies.length - 1}. (PowerPyx, GTABase)`;
  }
}

function renderAll() {
  renderProgressCard();
  renderAuditStrip();
  renderAuditStages();
  renderRoadmapStrip();
  renderNextUp();
  renderRoadmapFacts();
  renderRoadmapCards();
  renderCoverage();
  renderSavedState();
  renderMissablesTable();
  renderFooterFacts();
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
for (const button of document.querySelectorAll('button[data-kind]')) {
  button.addEventListener('click', () => {
    viewState.kind = button.dataset.kind;
    for (const other of document.querySelectorAll('button[data-kind]')) other.classList.toggle('active', other === button);
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
