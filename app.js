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
  if (s === '6' || s === '5') return 'blue';
  if (s === '4' || s === '3') return 'black';
  if (s === '2' || s === '1') return 'white';
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
let editingArrowIndex = -1;   // -1 = adăugare nouă, >=0 = editare
let googleConfig = { clientId: '', accessToken: '', userEmail: '' };
let selectedSessionId = null;

// ── LocalStorage helpers ───────────────────────────────
function save() {
  localStorage.setItem('archery_bow', JSON.stringify(bowConfig));
  localStorage.setItem('archery_sessions', JSON.stringify(sessions));
  localStorage.setItem('archery_google', JSON.stringify(googleConfig));
}

function autosaveSession() {
  if (!currentSession) return;
  const draft = {
    session: currentSession,
    endArrows: endArrows,
    currentEndIndex: currentEndIndex,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('archery_draft', JSON.stringify(draft));
  // Refresh Istoric dacă e vizibil
  const histTab = document.getElementById('tab-history');
  if (histTab && histTab.classList.contains('active')) renderHistory();
}

function clearDraft() {
  localStorage.removeItem('archery_draft');
}

function loadDraft() {
  try {
    const raw = localStorage.getItem('archery_draft');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}
function load() {
  try { bowConfig = JSON.parse(localStorage.getItem('archery_bow')) || bowConfig; } catch(e){}
  try { sessions = JSON.parse(localStorage.getItem('archery_sessions')) || []; } catch(e){}
  try { googleConfig = JSON.parse(localStorage.getItem('archery_google')) || googleConfig; } catch(e){}
  loadScriptConfig();
}

// ── Init ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initInstallPrompt();
  load();
  applyBowUI();
  renderHistory();
  renderGlobalStats();
  document.getElementById('origin-display').textContent = location.origin;

  // Verifică dacă există o sesiune neterminată
  const draft = loadDraft();
  if (draft && draft.session) {
    showDraftRecovery(draft);
  }

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
function closeModal(id, e) {
  if (!e || e.target === document.getElementById(id)) {
    document.getElementById(id)?.classList.add('hidden');
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
    // numEnds: nelimitat (0 = free-form), arrowsPerEnd: 0 = dinamic per serie
    config: { arrowsPerEnd: 0, numEnds: 0, distance: dist, target },
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

  // Protecție back button Android — împinge o stare în history
  history.pushState({ sessionActive: true }, '');

  updateSessionMeta();
  updateEndUI();
}

// Interceptează butonul Back când sesiunea e activă
window.addEventListener('popstate', (e) => {
  if (currentSession) {
    // Re-împinge starea ca să blocăm ieșirea
    history.pushState({ sessionActive: true }, '');
    // Arată dialog de confirmare
    showBackWarning();
  }
});

function showBackWarning() {
  // Arată toast + modal de confirmare
  const existing = document.getElementById('back-warning-modal');
  if (existing) { existing.classList.remove('hidden'); return; }

  const modal = document.createElement('div');
  modal.id = 'back-warning-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">⚠ Sesiune activă</div>
      <p style="font-size:.88rem;color:var(--text-muted);line-height:1.5">
        Ai o sesiune de antrenament în desfășurare.<br>
        Dacă ieși, datele nesalvate se pierd.
      </p>
      <div class="modal-actions" style="justify-content:space-between">
        <button class="btn-danger-sm" onclick="forceExitSession()">Abandon sesiune</button>
        <button class="btn-primary" onclick="document.getElementById('back-warning-modal').classList.add('hidden')">
          ← Continuă antrenamentul
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function forceExitSession() {
  document.getElementById('back-warning-modal')?.classList.add('hidden');
  cancelSession(false);
}

function updateSessionMeta() {
  const { config } = currentSession;
  const dateStr = new Date(currentSession.date).toLocaleDateString('ro-RO');
  let info = `${dateStr}`;
  if (config.distance) info += ` · ${config.distance}m`;
  if (currentSession.type === 'competition') info += ` · ${currentSession.competition.name}`;
  else info += ' · liber';
  document.getElementById('session-meta-info').textContent = info;
}

function currentArrowsPerEnd() {
  const { config } = currentSession;
  if (config.flatEnds && config.flatEnds.length > 0) {
    return config.flatEnds[currentEndIndex]?.arrowsPerEnd || config.arrowsPerEnd;
  }
  // Training free-form: fără limită fixă (0 = nelimitat)
  return config.arrowsPerEnd || Infinity;
}

function updateEndUI() {
  const freeForm = currentSession.config.arrowsPerEnd === 0;
  const numEnds = currentSession.config.numEnds;
  const ape = currentArrowsPerEnd();
  const doneArrows = currentSession.ends.reduce((s, e) => s + e.arrows.length, 0);

  document.getElementById('current-end').textContent = currentEndIndex + 1;
  document.getElementById('current-arrow-in-end').textContent = endArrows.length;

  // Label "/ total" apare doar dacă nu e free-form
  const totalEndsLabel = document.getElementById('total-ends-label');
  if (totalEndsLabel) {
    totalEndsLabel.textContent = (!freeForm && numEnds) ? `/ ${numEnds}` : '';
  }

  // Progress bar: pentru free-form folosim serii salvate
  let pct = 0;
  if (!freeForm && numEnds > 0) {
    pct = (currentSession.ends.length / numEnds) * 100;
  } else {
    // animație pulsantă la free-form
    pct = currentSession.ends.length > 0 ? Math.min(currentSession.ends.length * 8, 95) : 0;
  }
  document.getElementById('progress-fill').style.width = `${pct}%`;

  renderEndArrows(freeForm ? endArrows.length + 1 : ape);
  updateEndSummary();
  updateRunningTotals();

  const confirmBtn = document.getElementById('btn-confirm-end');
  // Free-form: poate salva seria dacă are cel puțin 1 săgeată
  if (freeForm) {
    confirmBtn.disabled = endArrows.length === 0;
    confirmBtn.textContent = endArrows.length > 0
      ? `✓ Salvează seria (${endArrows.length} săgeți)`
      : '✓ Salvează seria';
  } else {
    confirmBtn.disabled = endArrows.length < ape;
    confirmBtn.textContent = '✓ Salvează seria';
  }

  document.getElementById('btn-finish-session').disabled = currentSession.ends.length === 0;
  document.getElementById('btn-prev-end').style.display = currentEndIndex > 0 ? 'block' : 'none';

  // Autosave draft la fiecare modificare
  autosaveSession();
}

function renderEndArrows(ape) {
  const container = document.getElementById('end-arrows-display');
  const freeForm = currentSession && currentSession.config.arrowsPerEnd === 0;
  let html = '';
  const count = freeForm ? endArrows.length : ape;
  for (let i = 0; i < count; i++) {
    const a = endArrows[i];
    if (a) {
      const editing = editingArrowIndex === i;
      html += `<div class="arrow-chip ${scoreClass(a.score)}${editing ? ' editing' : ''}"
        onclick="editArrow(${i})" title="Click pentru editare">
        <span>${a.score}</span>
        <span class="chip-pos">${a.position ? `${a.position}h` : '—'}</span>
        ${editing ? '<span class="chip-edit-indicator">✎</span>' : ''}
      </div>`;
    } else if (!freeForm) {
      html += `<div class="arrow-chip pending">${i + 1}</div>`;
    }
  }
  // Free-form: arată un chip placeholder pentru săgeata următoare
  if (freeForm) {
    html += `<div class="arrow-chip pending" onclick="cancelEdit()" title="Adaugă săgeată nouă">+</div>`;
  }
  container.innerHTML = html;

  // Actualizează label buton în funcție de mod
  const addBtn = document.getElementById('btn-add-arrow');
  if (editingArrowIndex >= 0) {
    addBtn.textContent = `✎ Modifică Sg.${editingArrowIndex + 1}`;
    addBtn.style.background = '#7e22ce';
  } else {
    addBtn.textContent = '➤ Adaugă';
    addBtn.style.background = '';
  }
}

function editArrow(index) {
  const a = endArrows[index];
  if (!a) return;
  editingArrowIndex = index;
  // Populează câmpurile cu valorile existente
  document.getElementById('arrow-score').value = a.score;
  document.getElementById('arrow-position').value = a.position || '';
  document.getElementById('arrow-score').focus();
  renderEndArrows(currentArrowsPerEnd() === Infinity ? endArrows.length + 1 : currentArrowsPerEnd());
  toast(`Editezi săgeata ${index + 1} — modifică și apasă Modifică`, '');
}

function cancelEdit() {
  editingArrowIndex = -1;
  document.getElementById('arrow-score').value = '';
  document.getElementById('arrow-position').value = '';
  renderEndArrows(currentArrowsPerEnd() === Infinity ? endArrows.length + 1 : currentArrowsPerEnd());
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

  const pos = parseInt(posEl.value) || null;
  if (posEl.value && (pos < 1 || pos > 12)) { toast('Poziția trebuie să fie 1–12!'); posEl.focus(); return; }

  if (editingArrowIndex >= 0) {
    // Mod editare — înlocuiește săgeata existentă
    endArrows[editingArrowIndex] = { score, position: pos };
    editingArrowIndex = -1;
    scoreEl.value = '';
    posEl.value = '';
    scoreEl.focus();
    updateEndUI();
    toast('Săgeată modificată ✓', 'success');
    return;
  }

  // Mod adăugare normală
  const freeFormAdd = currentSession && currentSession.config.arrowsPerEnd === 0;
  if (!freeFormAdd) {
    const ape = currentArrowsPerEnd();
    if (endArrows.length >= ape) { toast('Seria este completă! Salvează și treci la seria nouă.'); return; }
  }

  endArrows.push({ score, position: pos });
  scoreEl.value = '';
  posEl.value = '';
  scoreEl.focus();
  updateEndUI();
}

function confirmEnd() {
  const freeForm = currentSession.config.arrowsPerEnd === 0;
  if (!freeForm) {
    const ape = currentArrowsPerEnd();
    if (endArrows.length < ape) return;
  } else {
    if (endArrows.length === 0) { toast('Adaugă cel puțin o săgeată!'); return; }
  }

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
  editingArrowIndex = -1;
  currentEndIndex++;
  // Refresh ținta grafică pentru seria nouă
  if (graphicInputMode) setTimeout(() => renderGraphicTarget(), 0);

  // Pentru concurs cu număr fix de serii
  if (!freeForm) {
    const numEnds = currentSession.config.numEnds;
    if (currentEndIndex >= numEnds) {
      document.getElementById('btn-confirm-end').textContent = '✓ Toate seriile complete!';
      document.getElementById('btn-confirm-end').disabled = true;
      document.getElementById('btn-finish-session').disabled = false;
      toast('Toate seriile complete! Apasă Finalizează.', 'success');
      return;
    }
  } else {
    toast(`Seria ${currentSession.ends.length} salvată ✓`, 'success');
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
  clearDraft();

  const saved = currentSession;
  cancelSession(false);

  toast(`✓ Sesiune salvată! Total: ${saved.totalScore} pt`, 'success');
  renderHistory();

  // Google Sheets sync (Apps Script)
  syncToGoogleSheets(saved);
}

function cancelSession(withConfirm = true) {
  if (withConfirm && !confirm('Anulezi sesiunea curentă? Datele se pierd.')) return;
  clearDraft();
  currentSession = null;
  currentEndIndex = 0;
  endArrows = [];
  editingArrowIndex = -1;
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
  const draft = loadDraft();

  // Draft item
  let draftHtml = '';
  if (draft && draft.session && !currentSession) {
    const s = draft.session;
    const date = new Date(s.date).toLocaleDateString('ro-RO');
    const time = new Date(s.date).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const savedAt = new Date(draft.savedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const dist = s.config?.distance ? `${s.config.distance}m · ` : '';
    const ends = s.ends?.length || 0;
    const inProgress = draft.endArrows?.length || 0;
    draftHtml = `<div class="history-item draft-item" onclick="resumeFromHistory()">
      <div class="history-item-icon">⏸️</div>
      <div class="history-item-info">
        <div class="history-item-title">
          <span class="draft-badge">ÎN CURS</span>
          ${s.bow?.name || '—'} · ${date} ${time}
        </div>
        <div class="history-item-sub">${dist}${ends} serii complete${inProgress > 0 ? ` · ${inProgress} sg. în progres` : ''} · salvat ${savedAt}</div>
      </div>
      <div class="history-item-score draft-score">▶</div>
    </div>`;
  }

  if (!filtered.length && !draftHtml) {
    list.innerHTML = `<div class="history-empty">Nicio sesiune înregistrată încă.<br>Apasă 🎯 Sesiune pentru a începe.</div>`;
    return;
  }

  list.innerHTML = draftHtml + filtered.map(s => {
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

function resumeFromHistory() {
  const draft = loadDraft();
  if (!draft) return;
  // Dacă e o sesiune activă, avertizează
  if (currentSession) {
    toast('Finalizează mai întâi sesiunea curentă!');
    return;
  }
  // Treci la tab-ul Home și reia sesiunea
  switchTab('home');
  currentSession = draft.session;
  currentEndIndex = draft.currentEndIndex || 0;
  endArrows = draft.endArrows || [];
  editingArrowIndex = -1;
  initSessionUI();
  toast('Sesiune reluată ✓', 'success');
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
  html += '<div id="centraj-section" class="centraj-section"></div>';
  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('modal-session-detail').classList.remove('hidden');
  // Randează centrajul după ce DOM-ul e gata
  setTimeout(() => renderCentrajSection(s, 'centraj-section'), 0);
}

function deleteSession() {
  if (!selectedSessionId) return;
  const session = sessions.find(s => s.id === selectedSessionId);
  if (!session) return;

  const hasSheets = scriptUrl && session.sheetName;
  const msg = hasSheets
    ? 'Ștergi această sesiune definitiv?\n\nApasă OK pentru a șterge și din Google Sheets.\nApasă Anulează pentru a păstra în Sheets.'
    : 'Ștergi această sesiune definitiv din memoria locală?';

  if (!confirm(msg)) return;

  // Șterge din Google Sheets dacă e sincronizată
  if (hasSheets) {
    deleteFromGoogleSheets(session);
  }

  sessions = sessions.filter(s => s.id !== selectedSessionId);
  save();
  closeModal('modal-session-detail');
  renderHistory();
  renderGlobalStats();
  toast(hasSheets ? 'Sesiune ștearsă local și din Sheets ✓' : 'Sesiune ștearsă');
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


// ── Centraj ────────────────────────────────────────────────
const SCORE_RADIUS = { 'X': 0, '10': 0.5, '9': 1.5, '8': 2.5, '7': 3.5,
  '6': 4.5, '5': 5.5, '4': 6.5, '3': 7.5, '2': 8.5, '1': 9.5, 'M': 10.5 };

function arrowToXY(score, position) {
  const r = SCORE_RADIUS[String(score)] ?? 5.0;
  if (r === 0 || !position) return { x: 0, y: 0, r: 0 };
  const angleDeg = (parseInt(position) / 12.0) * 360.0;
  const angleRad = angleDeg * Math.PI / 180;
  return { x: r * Math.sin(angleRad), y: r * Math.cos(angleRad), r };
}

function groupCenter(arrows) {
  // Separăm săgețile cu coordonate exacte de cele cu scor+oră
  const exact = arrows.filter(a => a.score !== 'M' && a.xMm !== undefined);
  const estimated = arrows.filter(a => a.score !== 'M' && a.xMm === undefined && a.position);
  const hasExact = exact.length > 0;

  // Dacă avem coordonate exacte, le folosim pe toate (mm)
  // Dacă nu, folosim estimarea din scor+oră (unități 0-10)
  let coords, unit, scaleFactor;

  if (hasExact) {
    // Coordonate exacte în mm — le folosim direct
    // Ignorăm săgețile fără coordonate exacte din această sesiune
    coords = exact.map(a => ({ x: a.xMm, y: a.yMm }));
    unit = 'mm';
    scaleFactor = 1; // mm direct
  } else if (estimated.length > 0) {
    // Estimare din scor+oră — unități 0-10
    coords = estimated.map(a => {
      const c = arrowToXY(a.score, a.position);
      return { x: c.x, y: c.y };
    });
    unit = 'u';
    scaleFactor = 10; // pentru SVG (normalizat 0-10 → *10 = mm echivalent)
  } else {
    return null;
  }

  if (!coords.length) return null;

  const cx = coords.reduce((s, c) => s + c.x, 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c.y, 0) / coords.length;
  const spread = Math.sqrt(coords.reduce((s, c) => s + (c.x-cx)**2 + (c.y-cy)**2, 0) / coords.length);
  const dist = Math.sqrt(cx*cx + cy*cy);
  const angleDeg = (Math.atan2(cx, cy) * 180 / Math.PI + 360) % 360;
  const hour = ((angleDeg / 360 * 12) % 12) || 12;

  return {
    cx: +cx.toFixed(hasExact ? 1 : 2),
    cy: +cy.toFixed(hasExact ? 1 : 2),
    spread: +spread.toFixed(hasExact ? 1 : 2),
    hour: +hour.toFixed(1),
    dist: +dist.toFixed(hasExact ? 1 : 2),
    count: coords.length,
    unit, hasExact,
    // _cx/_cy: in mm pt hasExact, in unitati 0-10.5 pt estimated
    _cx: cx,
    _cy: cy,
    _spread: spread,
    _dist: dist
  };
}

function directionLabel(hour) {
  const h = Math.round(hour);
  const labels = { 12: 'sus', 1: 'sus-dreapta', 2: 'sus-dreapta', 3: 'dreapta',
    4: 'jos-dreapta', 5: 'jos-dreapta', 6: 'jos', 7: 'jos-stânga', 8: 'jos-stânga',
    9: 'stânga', 10: 'sus-stânga', 11: 'sus-stânga' };
  return `${labels[h] || '—'} (${h})`;
}

function sessionCentraj(session) {
  const allArrows = session.ends.flatMap(e => e.arrows);
  const sessionCenter = groupCenter(allArrows);
  const endCenters = session.ends.map((end, i) => ({
    endNum: end.endNumber || i + 1,
    center: groupCenter(end.arrows)
  })).filter(e => e.center);
  return { sessionCenter, endCenters };
}

function renderCentrajSection(session, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const { sessionCenter, endCenters } = sessionCentraj(session);

  if (!sessionCenter) {
    el.innerHTML = '<p class="centraj-empty">Introdu poziții (oră) pentru a vedea centrajul.</p>';
    return;
  }

  const svgSize = 180;
  const CX = svgSize / 2;
  const CY = svgSize / 2;
  const maxR = 82;
  const scaleUnit = maxR / 10.5; // px per unitate (0-10.5)

  // Pentru mm exacti: convertim in unitati folosind diametrul tintei
  const targetKey = session && session.config && session.config.target;
  const targetDiameter = (targetKey && TARGET_SPECS[targetKey])
    ? TARGET_SPECS[targetKey].diameter : 1220;
  const mmToUnit = 10.5 / (targetDiameter / 2); // unitati per mm

  function toSVGUnit(x, y, isExact) {
    // Convertim totul in unitati 0-10.5 inainte de a aplica scale
    const ux = isExact ? x * mmToUnit : x;
    const uy = isExact ? y * mmToUnit : y;
    return { sx: CX + ux * scaleUnit, sy: CY - uy * scaleUnit };
  }

  let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" class="centraj-svg">`;

  // Inele tinta
  [{ r: 10.5, fill: '#f0f0f0' }, { r: 9.5, fill: '#1a1a1a' },
   { r: 7.5,  fill: '#2563eb' }, { r: 5.5,  fill: '#dc2626' },
   { r: 3.5,  fill: '#f59e0b' }, { r: 1.5,  fill: '#fbbf24' },
   { r: 0.5,  fill: '#fde68a' }
  ].forEach(ring => {
    svg += `<circle cx="${CX}" cy="${CY}" r="${ring.r * scaleUnit}" fill="${ring.fill}" opacity="0.75"/>`;
  });
  svg += `<line x1="${CX-maxR}" y1="${CY}" x2="${CX+maxR}" y2="${CY}" stroke="#fff" stroke-width="0.5" opacity="0.3"/>`;
  svg += `<line x1="${CX}" y1="${CY-maxR}" x2="${CX}" y2="${CY+maxR}" stroke="#fff" stroke-width="0.5" opacity="0.3"/>`;

  // Centre per serie
  const colors = ['#e8c44a','#3b82f6','#a855f7','#10b981','#f97316','#ef4444','#06b6d4','#84cc16'];
  endCenters.forEach((ec, i) => {
    const p = toSVGUnit(ec.center._cx, ec.center._cy, ec.center.hasExact);
    const col = colors[i % colors.length];
    svg += `<circle cx="${p.sx}" cy="${p.sy}" r="4" fill="${col}" opacity="0.85"/>`;
    svg += `<text x="${p.sx+5}" y="${p.sy+4}" fill="${col}" font-size="8" font-family="monospace" font-weight="bold">S${ec.endNum}</text>`;
  });

  // Centrul sesiunii
  const sc = toSVGUnit(sessionCenter._cx, sessionCenter._cy, sessionCenter.hasExact);
  svg += `<line x1="${CX}" y1="${CY}" x2="${sc.sx}" y2="${sc.sy}" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.7"/>`;
  svg += `<circle cx="${sc.sx}" cy="${sc.sy}" r="7" fill="none" stroke="#fff" stroke-width="2.5"/>`;
  svg += `<circle cx="${sc.sx}" cy="${sc.sy}" r="2.5" fill="#fff"/>`;
  svg += '</svg>';

  const dv = sessionCenter.dist;
  const isExact = sessionCenter.hasExact;
  const distLabel = isExact
    ? (dv < 5 ? 'centrat ✓' : dv < 20 ? 'ușor deplasat' : dv < 50 ? 'deplasat' : 'deplasat mult')
    : (dv < 0.5 ? 'centrat ✓' : dv < 2 ? 'ușor deplasat' : dv < 5 ? 'deplasat' : 'deplasat mult');
  const distColor = distLabel === 'centrat ✓' ? 'var(--accent3)' :
    distLabel === 'ușor deplasat' ? 'var(--accent)' : 'var(--accent2)';

  el.innerHTML = `
    <div class="centraj-wrap">
      <div class="centraj-target-wrap">${svg}</div>
      <div class="centraj-info">
        <div class="centraj-stat">
          <span class="centraj-label">Centru sesiune</span>
          <span class="centraj-value" style="color:${distColor}">${distLabel}</span>
        </div>
        <div class="centraj-stat">
          <span class="centraj-label">Direcție eroare</span>
          <span class="centraj-value">${sessionCenter.dist < 0.5 ? '—' : directionLabel(sessionCenter.hour)}</span>
        </div>
        <div class="centraj-stat">
          <span class="centraj-label">Dispersie grup</span>
          <span class="centraj-value">${sessionCenter.spread} ${sessionCenter.unit || 'u'}</span>
        </div>
        <div class="centraj-stat">
          <span class="centraj-label">Precizie date</span>
          <span class="centraj-value" style="font-size:.75rem">${sessionCenter.hasExact ? '📍 exacte (mm)' : '≈ estimate (oră)'}</span>
        </div>
        <div class="centraj-stat">
          <span class="centraj-label">Săgeți analizate</span>
          <span class="centraj-value">${sessionCenter.count}</span>
        </div>
        <div class="centraj-legend">
          <div class="legend-item"><span class="legend-dot" style="border:2px solid #fff;background:transparent"></span>Centru sesiune</div>
          ${endCenters.slice(0,6).map((ec,i) =>
            `<div class="legend-item"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span>Seria ${ec.endNum}</div>`
          ).join('')}
          ${endCenters.length > 6 ? `<div style="color:var(--text-dim);font-size:.68rem">+ ${endCenters.length-6} serii</div>` : ''}
        </div>
      </div>
    </div>`;
}


