/* =====================================================
   ARCHERY SCORER — app.js
   ===================================================== */

// ── World Archery Competition formats ──────────────────
const WA_COMPETITIONS = [
  {
    id: 'wa_1440_recurve',
    name: 'WA 1440 Round (Recurve)',
    badge: 'WA',
    category: 'Outdoor',
    rounds: [
      { distance: 90, arrowsPerEnd: 6, ends: 6, target: '122cm_10ring' },
      { distance: 70, arrowsPerEnd: 6, ends: 6, target: '122cm_10ring' },
      { distance: 50, arrowsPerEnd: 6, ends: 6, target: '80cm_10ring' },
      { distance: 30, arrowsPerEnd: 6, ends: 6, target: '80cm_10ring' },
    ],
    description: '144 săgeți · 4 distanțe: 90/70/50/30m · Țintă 122/80cm'
  },
  {
    id: 'wa_olympic_recurve',
    name: 'Olympic Round (70m Recurve)',
    badge: 'WA',
    category: 'Outdoor',
    rounds: [
      { distance: 70, arrowsPerEnd: 3, ends: 12, target: '122cm_10ring' },
    ],
    description: '36 săgeți · 70m · Eliminare directă · Țintă 122cm'
  },
  {
    id: 'wa_compound_outdoor',
    name: 'WA Compound Outdoor (50m)',
    badge: 'WA',
    category: 'Outdoor',
    rounds: [
      { distance: 50, arrowsPerEnd: 6, ends: 12, target: '80cm_6ring_compound' },
    ],
    description: '72 săgeți · 50m · Țintă 80cm 6 zone'
  },
  {
    id: 'wa_indoor_25',
    name: 'WA 25m Indoor Round',
    badge: 'WA',
    category: 'Indoor',
    rounds: [
      { distance: 25, arrowsPerEnd: 5, ends: 12, target: '60cm_indoor' },
    ],
    description: '60 săgeți · 25m · Țintă 60cm'
  },
  {
    id: 'wa_indoor_18',
    name: 'WA 18m Indoor Round',
    badge: 'WA',
    category: 'Indoor',
    rounds: [
      { distance: 18, arrowsPerEnd: 3, ends: 20, target: '40cm_10ring_indoor' },
    ],
    description: '60 săgeți · 18m · Țintă 40cm'
  },
  {
    id: 'wa_compound_indoor',
    name: 'WA 18m Compound Indoor',
    badge: 'WA',
    category: 'Indoor',
    rounds: [
      { distance: 18, arrowsPerEnd: 3, ends: 20, target: '40cm_5ring_indoor' },
    ],
    description: '60 săgeți · 18m · Țintă 40cm 5 zone (X/10/9/8/7)'
  },
  {
    id: 'wa_recurve_720',
    name: 'WA 720 Round (Recurve)',
    badge: 'WA',
    category: 'Outdoor',
    rounds: [
      { distance: 70, arrowsPerEnd: 6, ends: 12, target: '122cm_10ring' },
    ],
    description: '72 săgeți · 70m · Max 720 puncte'
  },
  {
    id: 'wa_field_24',
    name: 'WA Field Round (24 stâlpi)',
    badge: 'WA',
    category: 'Field',
    rounds: [
      { distance: 0, arrowsPerEnd: 3, ends: 24, target: 'field_60cm' },
    ],
    description: '72 săgeți · Distanțe variabile · Teren natural'
  },
  {
    id: 'national_ro',
    name: 'Campionat Național România',
    badge: '🇷🇴',
    category: 'Național',
    rounds: null,
    description: 'Format conform FR Tir cu Arcul',
    wip: true
  },
  {
    id: 'wa_3d',
    name: 'WA 3D Round',
    badge: 'WA',
    category: '3D',
    rounds: null,
    description: '24 animale × 3 săgeți · Scoring WAF',
    wip: true
  },
];

// ── Score → color class ────────────────────────────────
function scoreClass(s) {
  if (s === 'X' || s === '10' || s === '9') return 'gold';
  if (s === '8' || s === '7') return 'red';
  if (s === '6' || s === '5' || s === '4') return 'blue';
  if (s === 'M') return 'miss';
  return '';
}
function scoreNumeric(s) {
  if (s === 'X') return 10;
  if (s === 'M') return 0;
  return parseInt(s) || 0;
}

// ── State ──────────────────────────────────────────────
let bowConfig = { name: '', poundage: '', type: 'recurve' };
let sessions = [];
let currentSession = null;
let currentEndIndex = 0;
let endArrows = [];           // arrows recorded in current end
let googleConfig = { clientId: '', accessToken: '', userEmail: '' };
let selectedSessionId = null;

// ── LocalStorage helpers ───────────────────────────────
function save() {
  localStorage.setItem('archery_bow', JSON.stringify(bowConfig));
  localStorage.setItem('archery_sessions', JSON.stringify(sessions));
  localStorage.setItem('archery_google', JSON.stringify(googleConfig));
}
function load() {
  try { bowConfig = JSON.parse(localStorage.getItem('archery_bow')) || bowConfig; } catch(e){}
  try { sessions = JSON.parse(localStorage.getItem('archery_sessions')) || []; } catch(e){}
  try { googleConfig = JSON.parse(localStorage.getItem('archery_google')) || googleConfig; } catch(e){}
  loadScriptConfig();
}

// ── Init ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  load();
  applyBowUI();
  renderHistory();
  renderGlobalStats();
  document.getElementById('origin-display').textContent = location.origin;

  // Settings form
  document.getElementById('settings-bow-name').value = bowConfig.name || '';
  document.getElementById('settings-bow-poundage').value = bowConfig.poundage || '';
  document.getElementById('settings-bow-type').value = bowConfig.type || 'recurve';

  // Google config
  updateGoogleStatus();

  // Distance custom toggle
  document.getElementById('tr-distance').addEventListener('change', e => {
    document.getElementById('tr-distance-custom').classList.toggle('hidden', e.target.value !== 'custom');
  });

  // Keyboard shortcut: Enter to add arrow
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && currentSession) {
      const activeEl = document.activeElement;
      if (['arrow-score','arrow-position','btn-add-arrow'].includes(activeEl?.id)) {
        e.preventDefault();
        addArrow();
      }
    }
  });
});

// ── Tab switching ──────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
  if (tab === 'history') renderHistory();
  if (tab === 'export') renderGlobalStats();
}

// ── Bow UI ─────────────────────────────────────────────
function applyBowUI() {
  const badge = document.getElementById('bow-name-display');
  if (bowConfig.name) {
    badge.textContent = `${bowConfig.name}${bowConfig.poundage ? ` · ${bowConfig.poundage}#` : ''}`;
  } else {
    badge.textContent = '— Adaugă arc —';
  }
}
function openBowModal() {
  document.getElementById('modal-bow-name').value = bowConfig.name || '';
  document.getElementById('modal-bow-poundage').value = bowConfig.poundage || '';
  document.getElementById('modal-bow').classList.remove('hidden');
}
function closeBowModal(e) {
  if (!e || e.target === document.getElementById('modal-bow')) {
    document.getElementById('modal-bow').classList.add('hidden');
  }
}
function saveBowFromModal() {
  bowConfig.name = document.getElementById('modal-bow-name').value.trim();
  bowConfig.poundage = document.getElementById('modal-bow-poundage').value.trim();
  save(); applyBowUI();
  document.getElementById('modal-bow').classList.add('hidden');
  toast('Arc salvat ✓');
}
function saveBowSettings() {
  bowConfig.name = document.getElementById('settings-bow-name').value.trim();
  bowConfig.poundage = document.getElementById('settings-bow-poundage').value.trim();
  bowConfig.type = document.getElementById('settings-bow-type').value;
  save(); applyBowUI();
  toast('Setări salvate ✓', 'success');
}

// ── Session start ──────────────────────────────────────
function startSession(type) {
  if (!bowConfig.name) {
    toast('⚠ Adaugă mai întâi un arc!');
    openBowModal();
    return;
  }
  if (currentSession) {
    if (!confirm('Există o sesiune activă. O anulezi?')) return;
    cancelSession();
  }
  if (type === 'training') {
    document.getElementById('modal-training').classList.remove('hidden');
  } else {
    buildCompList();
    document.getElementById('modal-competition').classList.remove('hidden');
  }
}

function buildCompList() {
  const container = document.getElementById('comp-list');
  const categories = [...new Set(WA_COMPETITIONS.map(c => c.category))];
  container.innerHTML = categories.map(cat => {
    const items = WA_COMPETITIONS.filter(c => c.category === cat);
    return `<div class="subsection-title" style="margin-top:.5rem">${cat}</div>` +
      items.map(c => `
        <div class="comp-item${c.wip ? ' wip' : ''}" onclick="${c.wip ? '' : `selectCompetition('${c.id}')`}">
          <div class="comp-item-name">${c.name}
            ${c.badge ? `<span class="${c.wip ? 'wip-badge' : 'comp-badge'}">${c.badge}</span>` : ''}
            ${c.wip ? '<span class="wip-badge">🚧 Under construction</span>' : ''}
          </div>
          <div class="comp-item-details">${c.description}</div>
        </div>`).join('');
  }).join('');
}

function selectCompetition(id) {
  const comp = WA_COMPETITIONS.find(c => c.id === id);
  if (!comp || comp.wip) return;
  closeModal('modal-competition');
  beginCompetition(comp);
}

function beginTraining() {
  const ape = parseInt(document.getElementById('tr-arrows-per-end').value);
  const numEnds = parseInt(document.getElementById('tr-num-ends').value) || 10;
  const distEl = document.getElementById('tr-distance');
  let dist = distEl.value === 'custom'
    ? (parseInt(document.getElementById('tr-distance-custom').value) || 18)
    : parseInt(distEl.value);
  const target = document.getElementById('tr-target').value;

  currentSession = {
    id: Date.now().toString(),
    type: 'training',
    bow: { ...bowConfig },
    date: new Date().toISOString(),
    config: { arrowsPerEnd: ape, numEnds, distance: dist, target },
    ends: []
  };
  closeModal('modal-training');
  initSessionUI();
}

function beginCompetition(comp) {
  // Flatten all round-ends for a single linear flow
  const flatEnds = [];
  if (comp.rounds) {
    comp.rounds.forEach(r => {
      for (let i = 0; i < r.ends; i++) {
        flatEnds.push({ distance: r.distance, arrowsPerEnd: r.arrowsPerEnd, target: r.target });
      }
    });
  }
  const ape = comp.rounds ? comp.rounds[0].arrowsPerEnd : 3;
  const totalEnds = flatEnds.length || 12;

  currentSession = {
    id: Date.now().toString(),
    type: 'competition',
    bow: { ...bowConfig },
    date: new Date().toISOString(),
    competition: comp,
    config: {
      arrowsPerEnd: ape,
      numEnds: totalEnds,
      distance: comp.rounds ? comp.rounds[0].distance : 0,
      target: comp.rounds ? comp.rounds[0].target : '',
      flatEnds
    },
    ends: []
  };
  initSessionUI();
}

function initSessionUI() {
  currentEndIndex = 0;
  endArrows = [];
  document.getElementById('session-chooser')?.classList?.add('hidden');
  document.querySelector('.session-chooser').classList.add('hidden');
  document.getElementById('active-session').classList.remove('hidden');

  const badge = document.getElementById('session-type-badge');
  badge.textContent = currentSession.type === 'training' ? 'ANTRENAMENT' : 'CONCURS';
  badge.className = 'session-type-badge' + (currentSession.type === 'competition' ? ' comp' : '');

  updateSessionMeta();
  updateEndUI();
}

function updateSessionMeta() {
  const { config } = currentSession;
  const dateStr = new Date(currentSession.date).toLocaleDateString('ro-RO');
  let info = `${dateStr}`;
  if (config.distance) info += ` · ${config.distance}m`;
  if (currentSession.type === 'competition') info += ` · ${currentSession.competition.name}`;
  document.getElementById('session-meta-info').textContent = info;
  document.getElementById('total-ends').textContent = config.numEnds;
  document.getElementById('arrows-per-end').textContent = config.arrowsPerEnd;
}

function currentArrowsPerEnd() {
  const { config } = currentSession;
  if (config.flatEnds && config.flatEnds.length > 0) {
    return config.flatEnds[currentEndIndex]?.arrowsPerEnd || config.arrowsPerEnd;
  }
  return config.arrowsPerEnd;
}

function updateEndUI() {
  const numEnds = currentSession.config.numEnds;
  const ape = currentArrowsPerEnd();
  const totalArrows = numEnds * (currentSession.config.arrowsPerEnd);
  const doneArrows = currentSession.ends.reduce((s, e) => s + e.arrows.length, 0);

  document.getElementById('current-end').textContent = currentEndIndex + 1;
  document.getElementById('current-arrow-in-end').textContent = endArrows.length + 1;
  document.getElementById('arrows-per-end').textContent = ape;

  const pct = totalArrows > 0 ? (doneArrows / totalArrows) * 100 : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;

  renderEndArrows(ape);
  updateEndSummary();
  updateRunningTotals();

  const confirmBtn = document.getElementById('btn-confirm-end');
  confirmBtn.disabled = endArrows.length < ape;
  document.getElementById('btn-finish-session').disabled = currentSession.ends.length === 0;
  document.getElementById('btn-prev-end').style.display = currentEndIndex > 0 ? 'block' : 'none';
}

function renderEndArrows(ape) {
  const container = document.getElementById('end-arrows-display');
  let html = '';
  for (let i = 0; i < ape; i++) {
    const a = endArrows[i];
    if (a) {
      html += `<div class="arrow-chip ${scoreClass(a.score)}">
        <span>${a.score}</span>
        <span class="chip-pos">${a.position ? `${a.position}h` : ''}</span>
      </div>`;
    } else {
      html += `<div class="arrow-chip pending">${i + 1}</div>`;
    }
  }
  container.innerHTML = html;
}

function updateEndSummary() {
  if (endArrows.length === 0) {
    document.getElementById('end-summary').textContent = '';
    return;
  }
  const total = endArrows.reduce((s, a) => s + scoreNumeric(a.score), 0);
  const xs = endArrows.filter(a => a.score === 'X').length;
  document.getElementById('end-summary').textContent =
    `Seria curentă: ${total} pt${xs ? ` · ${xs}×` : ''}`;
}

function updateRunningTotals() {
  const allArrows = currentSession.ends.flatMap(e => e.arrows).concat(endArrows);
  const total = allArrows.reduce((s, a) => s + scoreNumeric(a.score), 0);
  const xs = allArrows.filter(a => a.score === 'X').length;
  const avg = allArrows.length > 0 ? (total / allArrows.length).toFixed(1) : '—';
  document.getElementById('running-total').textContent = total;
  document.getElementById('running-x').textContent = xs;
  document.getElementById('running-avg').textContent = avg;
}

// ── Arrow input ────────────────────────────────────────
function addArrow() {
  const scoreEl = document.getElementById('arrow-score');
  const posEl = document.getElementById('arrow-position');
  const score = scoreEl.value;
  if (!score) { toast('Selectează un punctaj!'); scoreEl.focus(); return; }

  const ape = currentArrowsPerEnd();
  if (endArrows.length >= ape) { toast('Seria este completă!'); return; }

  const pos = parseInt(posEl.value) || null;
  if (posEl.value && (pos < 1 || pos > 12)) { toast('Poziția trebuie să fie 1–12!'); posEl.focus(); return; }

  endArrows.push({ score, position: pos });
  scoreEl.value = '';
  posEl.value = '';
  scoreEl.focus();
  updateEndUI();
}

function confirmEnd() {
  const ape = currentArrowsPerEnd();
  if (endArrows.length < ape) return;

  const endTotal = endArrows.reduce((s, a) => s + scoreNumeric(a.score), 0);
  currentSession.ends.push({
    endNumber: currentEndIndex + 1,
    arrows: [...endArrows],
    total: endTotal,
    distance: currentSession.config.flatEnds
      ? currentSession.config.flatEnds[currentEndIndex]?.distance
      : currentSession.config.distance
  });

  endArrows = [];
  currentEndIndex++;

  const numEnds = currentSession.config.numEnds;
  if (currentEndIndex >= numEnds) {
    // All ends done — auto-finish prompt
    document.getElementById('btn-confirm-end').textContent = '✓ Toate seriile complete!';
    document.getElementById('btn-confirm-end').disabled = true;
    document.getElementById('btn-finish-session').disabled = false;
    toast('Toate seriile complete! Apasă Finalizează.', 'success');
  }
  updateEndUI();
}

function prevEnd() {
  if (currentEndIndex === 0) return;
  currentEndIndex--;
  endArrows = [...(currentSession.ends[currentEndIndex]?.arrows || [])];
  currentSession.ends.splice(currentEndIndex, 1);
  updateEndUI();
}

function finishSession() {
  if (!currentSession || currentSession.ends.length === 0) return;
  if (!confirm('Finalizezi și salvezi sesiunea?')) return;

  const allArrows = currentSession.ends.flatMap(e => e.arrows);
  currentSession.totalScore = allArrows.reduce((s, a) => s + scoreNumeric(a.score), 0);
  currentSession.totalXs = allArrows.filter(a => a.score === 'X').length;
  currentSession.totalArrows = allArrows.length;
  currentSession.avgPerArrow = allArrows.length > 0
    ? (currentSession.totalScore / allArrows.length).toFixed(2) : 0;

  sessions.unshift(currentSession);
  save();

  const saved = currentSession;
  cancelSession(false);

  toast(`✓ Sesiune salvată! Total: ${saved.totalScore} pt`, 'success');
  renderHistory();

  // Google Sheets sync (Apps Script)
  syncToGoogleSheets(saved);
}

function cancelSession(withConfirm = true) {
  if (withConfirm && !confirm('Anulezi sesiunea curentă? Datele se pierd.')) return;
  currentSession = null;
  currentEndIndex = 0;
  endArrows = [];
  document.querySelector('.session-chooser').classList.remove('hidden');
  document.getElementById('active-session').classList.add('hidden');
  document.getElementById('btn-confirm-end').textContent = '✓ Confirmă seria';
  document.getElementById('running-total').textContent = '0';
  document.getElementById('running-x').textContent = '0';
  document.getElementById('running-avg').textContent = '—';
}

function confirmCancelSession() {
  cancelSession(true);
}

// ── History ────────────────────────────────────────────
function renderHistory() {
  const filter = document.getElementById('filter-type')?.value || 'all';
  const list = document.getElementById('history-list');
  const filtered = sessions.filter(s => filter === 'all' || s.type === filter);

  if (!filtered.length) {
    list.innerHTML = `<div class="history-empty">Nicio sesiune înregistrată încă.<br>Apasă 🎯 Sesiune pentru a începe.</div>`;
    return;
  }

  list.innerHTML = filtered.map(s => {
    const date = new Date(s.date).toLocaleDateString('ro-RO');
    const time = new Date(s.date).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const icon = s.type === 'training' ? '🏋️' : '🏆';
    const dist = s.config.distance ? `${s.config.distance}m · ` : '';
    const sub = s.type === 'training'
      ? `${dist}${s.totalArrows || 0} săgeți · ${s.ends.length} serii`
      : `${s.competition?.name || ''} · ${s.totalArrows || 0} săgeți`;
    return `<div class="history-item" onclick="openSessionDetail('${s.id}')">
      <div class="history-item-icon">${icon}</div>
      <div class="history-item-info">
        <div class="history-item-title">${s.bow?.name || '—'} · ${date} ${time}</div>
        <div class="history-item-sub">${sub}</div>
      </div>
      <div class="history-item-score">${s.totalScore ?? '—'}</div>
    </div>`;
  }).join('');
}

function openSessionDetail(id) {
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  selectedSessionId = id;

  document.getElementById('detail-title').textContent =
    `${s.type === 'training' ? '🏋️ Antrenament' : '🏆 Concurs'} · ${new Date(s.date).toLocaleDateString('ro-RO')}`;

  const avg = s.avgPerArrow || '—';
  let html = `
    <div class="detail-summary">
      <div class="detail-stat"><span class="detail-stat-label">Total</span><span class="detail-stat-value">${s.totalScore ?? 0}</span></div>
      <div class="detail-stat"><span class="detail-stat-label">X-uri</span><span class="detail-stat-value">${s.totalXs ?? 0}</span></div>
      <div class="detail-stat"><span class="detail-stat-label">Medie/↗</span><span class="detail-stat-value">${avg}</span></div>
    </div>
    <div class="detail-meta" style="font-size:.75rem;color:var(--text-muted);margin-bottom:.75rem;">
      Arc: ${s.bow?.name || '—'} · ${s.config.distance ? s.config.distance + 'm' : ''}
      ${s.bow?.poundage ? '· ' + s.bow.poundage + '#' : ''}
    </div>
    <div class="detail-ends">`;

  s.ends.forEach(end => {
    const chips = end.arrows.map(a =>
      `<div class="arrow-chip ${scoreClass(a.score)}" style="padding:.2rem .4rem;font-size:.78rem;">
        <span>${a.score}</span>
        ${a.position ? `<span class="chip-pos">${a.position}h</span>` : ''}
      </div>`
    ).join('');
    html += `<div class="detail-end-row">
      <span class="detail-end-num">S${end.endNumber}</span>
      <div class="detail-end-arrows">${chips}</div>
      <span class="detail-end-total">${end.total}</span>
    </div>`;
  });

  html += '</div>';
  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('modal-session-detail').classList.remove('hidden');
}

function deleteSession() {
  if (!selectedSessionId) return;
  if (!confirm('Ștergi această sesiune definitiv?')) return;
  sessions = sessions.filter(s => s.id !== selectedSessionId);
  save();
  closeModal('modal-session-detail');
  renderHistory();
  renderGlobalStats();
  toast('Sesiune ștearsă');
}

// ── Global stats ───────────────────────────────────────
function renderGlobalStats() {
  const el = document.getElementById('global-stats');
  if (!el) return;
  if (!sessions.length) { el.innerHTML = '<p style="color:var(--text-dim);font-size:.8rem">Nicio sesiune înregistrată.</p>'; return; }

  const allArrows = sessions.flatMap(s => s.ends.flatMap(e => e.arrows));
  const totalPts = sessions.reduce((s, x) => s + (x.totalScore || 0), 0);
  const totalXs = sessions.reduce((s, x) => s + (x.totalXs || 0), 0);
  const best = Math.max(...sessions.map(s => s.totalScore || 0));
  const avg = allArrows.length > 0 ? (totalPts / allArrows.length).toFixed(2) : '—';

  el.innerHTML = [
    ['Sesiuni', sessions.length],
    ['Săgeți totale', allArrows.length],
    ['Puncte totale', totalPts],
    ['Cel mai bun scor', best],
    ['X-uri totale', totalXs],
    ['Medie/săgeată', avg],
  ].map(([l, v]) => `<div class="stat-card">
    <div class="stat-card-label">${l}</div>
    <div class="stat-card-value">${v}</div>
  </div>`).join('');
}

// ── Export Excel ───────────────────────────────────────
function exportExcel() {
  if (!sessions.length) { toast('Nicio sesiune de exportat!'); return; }

  // Build CSV per session — we'll produce one workbook via SheetJS
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => doExcelExport();
  document.head.appendChild(script);
}

function doExcelExport() {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [['Data', 'Tip', 'Arc', 'Distanță (m)', 'Săgeți', 'Serii', 'Total', 'X-uri', 'Medie/Săgeată']];
  sessions.forEach(s => {
    summaryRows.push([
      new Date(s.date).toLocaleDateString('ro-RO'),
      s.type === 'training' ? 'Antrenament' : 'Concurs',
      s.bow?.name || '',
      s.config.distance || '',
      s.totalArrows || 0,
      s.ends.length,
      s.totalScore || 0,
      s.totalXs || 0,
      s.avgPerArrow || ''
    ]);
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rezumat');

  // One sheet per session
  sessions.forEach(s => {
    const dateStr = new Date(s.date).toLocaleDateString('ro-RO').replace(/\//g, '-');
    const bowShort = (s.bow?.name || 'Arc').substring(0, 12).replace(/[^a-zA-Z0-9\s]/g, '');
    const type = s.type === 'training' ? 'Ant' : 'Cnc';
    const sheetName = `${type}_${bowShort}_${dateStr}`.substring(0, 31);

    const rows = [
      ['Tip', s.type === 'training' ? 'Antrenament' : 'Concurs'],
      ['Arc', s.bow?.name || ''],
      ['Putere (lbs)', s.bow?.poundage || ''],
      ['Data', new Date(s.date).toLocaleString('ro-RO')],
      ['Distanță (m)', s.config.distance || ''],
      ['Tip țintă', s.config.target || ''],
      [],
      ['Seria', 'Săgeată 1', 'Pos 1', 'Săgeată 2', 'Pos 2', 'Săgeată 3', 'Pos 3', 'Săgeată 4', 'Pos 4', 'Săgeată 5', 'Pos 5', 'Săgeată 6', 'Pos 6', 'Total serie']
    ];

    s.ends.forEach(end => {
      const row = [end.endNumber];
      for (let i = 0; i < 6; i++) {
        const a = end.arrows[i];
        row.push(a ? a.score : '');
        row.push(a?.position ? `${a.position}h` : '');
      }
      row.push(end.total);
      rows.push(row);
    });

    rows.push([]);
    rows.push(['TOTAL', '', '', '', '', '', '', '', '', '', '', '', '', s.totalScore || 0]);
    rows.push(['X-uri', s.totalXs || 0]);
    rows.push(['Medie/săgeată', s.avgPerArrow || '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `Archery_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✓ Excel descărcat!', 'success');
}

// ── Export CSV ────────────────────────────────────────
function exportCSV() {
  if (!sessions.length) { toast('Nicio sesiune de exportat!'); return; }
  let csv = 'SessionID,Data,Tip,Arc,Putere,Distanta,TipTinta,Seria,Sageata,Punctaj,Pozitie\n';
  sessions.forEach(s => {
    const date = new Date(s.date).toISOString().slice(0,10);
    s.ends.forEach(end => {
      end.arrows.forEach((a, i) => {
        csv += [s.id, date, s.type, s.bow?.name || '', s.bow?.poundage || '',
          s.config.distance || '', s.config.target || '',
          end.endNumber, i + 1, a.score, a.position || ''].join(',') + '\n';
      });
    });
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Archery_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('✓ CSV descărcat!', 'success');
}

// ── Google Sheets via Apps Script ────────────────────────
let scriptUrl = '';
let pendingSync = [];   // sessions not yet synced

function loadScriptConfig() {
  scriptUrl = localStorage.getItem('archery_script_url') || '';
  try { pendingSync = JSON.parse(localStorage.getItem('archery_pending_sync')) || []; } catch(e){ pendingSync = []; }
}

function saveScriptConfig() {
  localStorage.setItem('archery_script_url', scriptUrl);
  localStorage.setItem('archery_pending_sync', JSON.stringify(pendingSync));
}

function openGoogleSheetsSetup() {
  const panel = document.getElementById('gsheets-config');
  panel.classList.toggle('hidden');
  if (scriptUrl) document.getElementById('google-script-url').value = scriptUrl;
}

async function saveScriptUrl() {
  const url = document.getElementById('google-script-url').value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    showTestResult('error', '⚠ URL invalid. Trebuie să înceapă cu https://script.google.com');
    return;
  }
  scriptUrl = url;
  saveScriptConfig();

  // Test connection
  showTestResult('loading', '⏳ Testez conexiunea...');
  setSyncState('syncing', 'Testez conexiunea...');
  try {
    const res = await fetch(scriptUrl, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { json = null; }
    if (json && json.status === 'ok') {
      showTestResult('ok', '✓ Conexiune reușită! Scriptul răspunde corect.');
      setSyncState('ok', 'Conectat — sincronizare automată activă');
      updateSyncStatusBar();
      toast('✓ Google Sheets configurat!', 'success');
      // Sync any pending sessions
      if (pendingSync.length > 0) syncAllPending();
    } else {
      showTestResult('error', '⚠ Scriptul a răspuns dar cu eroare. Reverificați deployment-ul.');
      setSyncState('error', 'Eroare script — verifică deployment');
    }
  } catch(err) {
    showTestResult('error', '✗ Conexiune eșuată: ' + err.message);
    setSyncState('error', 'Conexiune eșuată');
  }
}

function showTestResult(type, msg) {
  const el = document.getElementById('script-test-result');
  el.classList.remove('hidden');
  el.style.background = type === 'ok' ? 'rgba(39,174,96,.15)' : type === 'error' ? 'rgba(192,57,43,.15)' : 'rgba(59,130,246,.1)';
  el.style.borderLeft = `3px solid ${type === 'ok' ? 'var(--accent3)' : type === 'error' ? 'var(--accent2)' : '#3b82f6'}`;
  el.style.color = type === 'ok' ? 'var(--accent3)' : type === 'error' ? '#e74c3c' : '#93c5fd';
  el.textContent = msg;
}

// State: 'none' | 'ok' | 'error' | 'pending' | 'syncing'
function setSyncState(state, text) {
  const dot = document.getElementById('sync-status-dot');
  const barDot = document.getElementById('sync-bar-dot');
  const barText = document.getElementById('sync-bar-text');
  const bar = document.getElementById('sync-status-bar');
  const statusText = document.getElementById('gsheets-status-text');
  const manualBtn = document.getElementById('sync-manual-btn');

  // Remove all state classes
  ['ok','error','pending','syncing'].forEach(c => {
    dot?.classList.remove(c);
    barDot?.classList.remove(c);
  });

  if (state !== 'none') {
    dot?.classList.add(state);
    barDot?.classList.add(state);
    bar?.classList.remove('hidden');
  } else {
    bar?.classList.add('hidden');
  }

  if (barText) barText.textContent = text;
  if (statusText) statusText.textContent = text;

  // Show manual sync button if pending or error
  if (manualBtn) {
    manualBtn.style.display = (state === 'pending' || state === 'error') ? 'block' : 'none';
  }
}

function updateSyncStatusBar() {
  if (!scriptUrl) {
    setSyncState('none', 'Neconfigurat — apasă pentru configurare');
    return;
  }
  if (pendingSync.length > 0) {
    setSyncState('pending', `${pendingSync.length} sesiune(i) în așteptare — apasă pentru sync`);
  } else {
    setSyncState('ok', 'Conectat — toate sesiunile sincronizate');
  }
}

async function syncToGoogleSheets(session) {
  if (!scriptUrl) {
    pendingSync.push(session.id);
    saveScriptConfig();
    updateSyncStatusBar();
    return;
  }
  setSyncState('syncing', 'Se sincronizează...');
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(session)
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { json = null; }

    if (json && json.status === 'ok') {
      // Remove from pending if it was there
      pendingSync = pendingSync.filter(id => id !== session.id);
      saveScriptConfig();
      setSyncState('ok', `✓ Sincronizat — foaie: ${json.sheet || ''}`);
      toast('✓ Salvat în Google Sheets!', 'success');
    } else {
      throw new Error(json?.message || 'Răspuns neașteptat');
    }
  } catch(err) {
    console.error('Sync error:', err);
    if (!pendingSync.includes(session.id)) {
      pendingSync.push(session.id);
      saveScriptConfig();
    }
    setSyncState('error', '✗ Eroare sync — ' + err.message.substring(0, 50));
    toast('Eroare sync Google Sheets', 'error');
  }
}

async function syncAllPending() {
  if (!scriptUrl || pendingSync.length === 0) return;
  setSyncState('syncing', `Se sincronizează ${pendingSync.length} sesiune(i)...`);
  const ids = [...pendingSync];
  for (const id of ids) {
    const session = sessions.find(s => s.id === id);
    if (session) await syncToGoogleSheets(session);
  }
  updateSyncStatusBar();
}

function updateGoogleStatus() {
  loadScriptConfig();
  updateSyncStatusBar();
}

// ── Service Worker ─────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  });
}

// ── Toast ──────────────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast${type ? ' ' + type : ''}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}
