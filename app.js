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
  renderEvolutionChart();
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
      html += `<div class="arrow-chip ${scoreClass(a.score)}${editing ? ' editing' : ''}" onclick="editArrow(${i})" title="Click pentru editare">
        <span>${a.score}</span>
        <span class="chip-pos">${a.position ? `${a.position}h` : '—'}</span>
        ${editing ? '<span class="chip-edit-indicator">✎</span>' : ''}
        <button onclick="event.stopPropagation();deleteArrow(${i})" class="chip-delete-btn" title="Șterge">✕</button>
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

function deleteArrow(index) {
  if (index < 0 || index >= endArrows.length) return;
  endArrows.splice(index, 1);
  if (editingArrowIndex === index) {
    editingArrowIndex = -1;
    document.getElementById('arrow-score').value = '';
    document.getElementById('arrow-position').value = '';
  } else if (editingArrowIndex > index) {
    editingArrowIndex--;
  }
  updateEndUI();
  toast('Săgeata ștearsă');
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
  renderEvolutionChart();
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
    _cx: cx,  // mm (hasExact) sau unitati 0-10.5 (estimated)
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
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxR = 82;
  const scaleUnit = maxR / 10.5; // px per unitate (mod numeric)

  // Pentru mm exacti: scale_mm = maxR / (raza_tinta_mm)
  // Raza tintei depinde de tipul ales; default 122cm => 610mm
  const targetKey = session && session.config && session.config.target;
  const targetRadius = (targetKey && typeof TARGET_SPECS !== 'undefined' && TARGET_SPECS[targetKey])
    ? TARGET_SPECS[targetKey].diameter / 2 : 610;
  const scaleMm = maxR / targetRadius; // px per mm

  function toSVG(x, y, isExact) {
    const s = isExact ? scaleMm : scaleUnit;
    return { sx: cx + x * s, sy: cy - y * s };
  }

  let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" class="centraj-svg">`;
  [{ r: 10.5, fill: '#f0f0f0' }, { r: 9.5, fill: '#1a1a1a' },
   { r: 7.5,  fill: '#2563eb' }, { r: 5.5,  fill: '#dc2626' },
   { r: 3.5,  fill: '#f59e0b' }, { r: 1.5,  fill: '#fbbf24' },
   { r: 0.5,  fill: '#fde68a' }
  ].forEach(ring => {
    svg += `<circle cx="${cx}" cy="${cy}" r="${ring.r * scaleUnit}" fill="${ring.fill}" opacity="0.75"/>`;
  });
  svg += `<line x1="${cx-maxR}" y1="${cy}" x2="${cx+maxR}" y2="${cy}" stroke="#fff" stroke-width="0.5" opacity="0.3"/>`;
  svg += `<line x1="${cx}" y1="${cy-maxR}" x2="${cx}" y2="${cy+maxR}" stroke="#fff" stroke-width="0.5" opacity="0.3"/>`;

  const colors = ['#e8c44a','#3b82f6','#a855f7','#10b981','#f97316','#ef4444','#06b6d4','#84cc16'];
  endCenters.forEach((ec, i) => {
    const p = toSVG(ec.center._cx ?? ec.center.cx, ec.center._cy ?? ec.center.cy, ec.center.hasExact);
    const col = colors[i % colors.length];
    svg += `<circle cx="${p.sx}" cy="${p.sy}" r="4" fill="${col}" opacity="0.85"/>`;
    svg += `<text x="${p.sx+5}" y="${p.sy+4}" fill="${col}" font-size="8" font-family="monospace" font-weight="bold">S${ec.endNum}</text>`;
  });

  const sc = toSVG(sessionCenter._cx ?? sessionCenter.cx, sessionCenter._cy ?? sessionCenter.cy, sessionCenter.hasExact);
  svg += `<line x1="${cx}" y1="${cy}" x2="${sc.sx}" y2="${sc.sy}" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.7"/>`;
  svg += `<circle cx="${sc.sx}" cy="${sc.sy}" r="7" fill="none" stroke="#fff" stroke-width="2.5"/>`;
  svg += `<circle cx="${sc.sx}" cy="${sc.sy}" r="2.5" fill="#fff"/>`;
  svg += '</svg>';

  // Praguri diferite pentru mm exacti vs unitati estimate
  // Unitati 0-10: inel X=0, 10=0.5, 9=1.5 ... 1=9.5 — prag "centrat" = sub 0.5u
  // MM exacti: prag "centrat" = sub 5mm (raza X-ring ~30mm pt 122cm)
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
          <span class="centraj-value">
            X: ${sessionCenter.cx > 0 ? '+' : ''}${sessionCenter.cx} ${sessionCenter.unit || 'u'}
            &nbsp;·&nbsp;
            Y: ${sessionCenter.cy > 0 ? '+' : ''}${sessionCenter.cy} ${sessionCenter.unit || 'u'}
          </span>
        </div>
        <div class="centraj-stat">
          <span class="centraj-label">Distanță centru</span>
          <span class="centraj-value" style="color:${distColor}">${sessionCenter.dist} ${sessionCenter.unit || 'u'} — ${distLabel}</span>
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


// ── Mod grafic input săgeți ────────────────────────────────

const TARGET_SPECS = {
  // minScore: scorul minim al inelului exterior vizibil
  // 10 zone: 1-10+X, 5 zone: 6-10+X, 6 zone: 5-10+X
  '40cm_10ring_indoor':  { name: '40cm 10 zone indoor',  diameter: 400,  rings: 10, minScore: 1 },
  '40cm_5ring_indoor':   { name: '40cm 5 zone compound', diameter: 400,  rings: 5,  minScore: 6 },
  '60cm_indoor':         { name: '60cm indoor',          diameter: 600,  rings: 10, minScore: 1 },
  '80cm_10ring':         { name: '80cm 10 zone',         diameter: 800,  rings: 10, minScore: 1 },
  '80cm_6ring_compound': { name: '80cm 6 zone compound', diameter: 480,  rings: 6,  minScore: 5 },
  '80cm_X_compound':     { name: '80cm X10 compound',    diameter: 800,  rings: 10, minScore: 1 },
  '122cm_10ring':        { name: '122cm 10 zone',        diameter: 1220, rings: 10, minScore: 1 },
  '122cm_5ring':         { name: '122cm 5 zone',         diameter: 1220, rings: 5,  minScore: 6 },
  'field_60cm':          { name: '60cm Field',           diameter: 600,  rings: 6,  minScore: 5 },
  'field_80cm':          { name: '80cm Field',           diameter: 800,  rings: 6,  minScore: 5 },
  '3d_waf':              { name: '3D WAF',               diameter: 400,  rings: 5,  minScore: 6 },
};

// Culori inele (index 0=inel 1pt exterior ... 9=inel 10pt interior)
const RING_COLORS_OUTER = ['#f5f5f5','#f5f5f5','#222222','#222222','#2563eb','#2563eb',
                            '#dc2626','#dc2626','#fbbf24','#fbbf24'];

let graphicInputMode = false;

function getTargetSpec() {
  const key = currentSession?.config?.target;
  return (key && TARGET_SPECS[key]) ? TARGET_SPECS[key] : TARGET_SPECS['122cm_10ring'];
}

function mmToScore(distMm, spec) {
  const rw = spec.diameter / 20; // lățimea unui inel în mm
  // X: distanță <= rw/2 (raza inelului X)
  if (distMm <= rw / 2) return 'X';
  // ring=1 este EXTERIOR (1pt), ring=10 este cel mai interior (10pt)
  // Raza exterioară a inelului cu scor S = rw * (11 - S)
  // Ex: inel 10 (interior) → raza = rw*1, inel 1 (exterior) → raza = rw*10
  for (let score = 10; score >= 1; score--) {
    const outerRadiusMm = rw * (11 - score);
    if (distMm <= outerRadiusMm) return String(score);
  }
  return 'M';
}

function xyToHour(x, y) {
  // x+ dreapta, y- sus; ora 12 = sus, 3 = dreapta, 6 = jos, 9 = stânga
  const angleDeg = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
  return Math.round(angleDeg / 30) % 12 || 12;
}

function arrowDotColor(score) {
  if (score === 'X' || score === '10' || score === '9') return '#e8c44a';
  if (score === '8' || score === '7') return '#dc2626';
  if (score === '6' || score === '5') return '#3b82f6';
  if (score === '4' || score === '3') return '#555';
  if (score === '2' || score === '1') return '#e5e5e5';
  return '#888';
}

function toggleInputMode() {
  graphicInputMode = !graphicInputMode;
  const btn = document.getElementById('btn-toggle-mode');
  if (btn) {
    btn.textContent = graphicInputMode ? '🔢 Mod numeric' : '🎯 Mod grafic';
  }
  document.getElementById('numeric-input-section')?.classList.toggle('hidden', graphicInputMode);
  const gs = document.getElementById('graphic-input-section');
  if (gs) {
    gs.classList.toggle('hidden', !graphicInputMode);
    if (graphicInputMode) renderGraphicTarget();
  }
}

function renderGraphicTarget() {
  const container = document.getElementById('graphic-target-canvas');
  if (!container) return;

  const spec = getTargetSpec();
  const rw = spec.diameter / 20; // mm per inel
  const SVG = 210;
  const CX = SVG / 2, CY = SVG / 2;
  const maxR = 98; // px raza exterioară
  const scale = maxR / (spec.diameter / 2); // px per mm

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', SVG); svg.setAttribute('height', SVG);
  svg.setAttribute('viewBox', `0 0 ${SVG} ${SVG}`);
  svg.style.cssText = 'cursor:crosshair;touch-action:none;user-select:none;display:block;margin:0 auto;';

  const mk = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    return el;
  };

  // ── Culorile inelelor după SCOR (nu după index de desenare!)
  // Scor 9-10 = galben, 7-8 = roșu, 5-6 = albastru, 3-4 = negru, 1-2 = alb
  // ring=1 este EXTERIOR (1pt), ring=10 este INTERIOR (10pt)
  // Raza exterioară a inelului cu scor S = rw * (11 - S)
  // Deci desenăm inele de la scor=1 (cel mai mare cerc) la scor=10 (cel mai mic)
  const scoreToFill = (score) => {
    if (score >= 9) return '#fbbf24'; // galben (9,10)
    if (score >= 7) return '#dc2626'; // roșu   (7,8)
    if (score >= 5) return '#2563eb'; // albastru(5,6)
    if (score >= 3) return '#1a1a1a'; // negru   (3,4)
    return '#f0f0f0';                  // alb     (1,2)
  };
  const scoreToBorder = (score) => {
    if (score >= 9) return '#d97706';
    if (score >= 7) return '#991b1b';
    if (score >= 5) return '#1d4ed8';
    if (score >= 3) return '#444';
    return '#bbb';
  };

  // Desenăm de la exterior spre interior, doar inelele vizibile pt acest tip de țintă
  const minScore = spec.minScore || 1;
  for (let score = minScore; score <= 10; score++) {
    const outerRadiusMm = rw * (11 - score); // mm
    const rPx = Math.min(outerRadiusMm * scale, maxR);
    svg.appendChild(mk('circle', {
      cx: CX, cy: CY, r: rPx,
      fill: scoreToFill(score),
      stroke: scoreToBorder(score),
      'stroke-width': score % 2 === 0 ? '1.2' : '0.4'
    }));
  }

  // X-ring (interior față de inelul 10, galben mai deschis)
  svg.appendChild(mk('circle', {
    cx: CX, cy: CY, r: (rw / 2) * scale,
    fill: '#fde68a', stroke: '#d97706', 'stroke-width': '1'
  }));

  // Crosshair (linii fine)
  svg.appendChild(mk('line', { x1:CX-maxR,y1:CY,x2:CX+maxR,y2:CY, stroke:'rgba(0,0,0,0.15)','stroke-width':'0.6' }));
  svg.appendChild(mk('line', { x1:CX,y1:CY-maxR,x2:CX,y2:CY+maxR, stroke:'rgba(0,0,0,0.15)','stroke-width':'0.6' }));

  // Săgețile deja înregistrate în seria curentă
  endArrows.forEach((a) => {
    if (a.xMm === undefined) return;
    const px = CX + a.xMm * scale;
    const py = CY + a.yMm * scale;
    svg.appendChild(mk('circle', { cx:px, cy:py, r:5, fill:arrowDotColor(a.score), stroke:'#fff','stroke-width':'1.5',opacity:'0.95' }));
    const t = mk('text', { x:px+7, y:py+4, fill:'#fff','font-size':'8','font-family':'monospace','font-weight':'bold','text-shadow':'0 0 2px #000' });
    t.textContent = a.score;
    svg.appendChild(t);
  });

  // Preview dot
  svg.appendChild(mk('circle', { id:'preview-dot', cx:-50, cy:-50, r:7,
    fill:'none', stroke:'rgba(255,255,255,0.8)','stroke-width':'2','pointer-events':'none' }));

  // ── Zoom canvas (mini target amplificat la poziția cursorului) ──
  const ZOOM_SIZE = 100;
  const ZOOM_FACTOR = 4;
  const zoomEl = document.getElementById('graphic-zoom-canvas');

  const getXY = (e) => {
    const rect = svg.getBoundingClientRect();
    const sx = SVG / rect.width, sy = SVG / rect.height;
    const src = e.touches ? e.touches[0] : e.changedTouches ? e.changedTouches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  };

  const updateZoom = (svgX, svgY) => {
    if (!zoomEl) return;
    // Ridensenează zoom-ul centrat pe poziția cursorului
    const zc = ZOOM_SIZE / 2;
    const zScale = scale * ZOOM_FACTOR;

    let zSvg = `<svg width="${ZOOM_SIZE}" height="${ZOOM_SIZE}" viewBox="0 0 ${ZOOM_SIZE} ${ZOOM_SIZE}">`;
    // Offset față de centrul țintei
    const offX = svgX - CX;
    const offY = svgY - CY;
    // Desenăm inelele relative la poziția cursorului
    for (let score = minScore; score <= 10; score++) {
      const rMm = rw * (11 - score);
      const rPx = rMm * zScale;
      const cx2 = zc - offX * ZOOM_FACTOR;
      const cy2 = zc - offY * ZOOM_FACTOR;
      zSvg += `<circle cx="${cx2}" cy="${cy2}" r="${rPx}" fill="${scoreToFill(score)}" stroke="${scoreToBorder(score)}" stroke-width="${score%2===0?'1.5':'0.5'}"/>`;
    }
    // X-ring
    zSvg += `<circle cx="${zc - offX*ZOOM_FACTOR}" cy="${zc - offY*ZOOM_FACTOR}" r="${(rw/2)*zScale}" fill="#fde68a" stroke="#d97706" stroke-width="1"/>`;
    // Crosshair la centrul țintei
    const tcx = zc - offX * ZOOM_FACTOR;
    const tcy = zc - offY * ZOOM_FACTOR;
    zSvg += `<line x1="${tcx-30}" y1="${tcy}" x2="${tcx+30}" y2="${tcy}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>`;
    zSvg += `<line x1="${tcx}" y1="${tcy-30}" x2="${tcx}" y2="${tcy+30}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>`;
    // Cursor (crosshair roșu la poziția curentă)
    zSvg += `<line x1="${zc-10}" y1="${zc}" x2="${zc+10}" y2="${zc}" stroke="#fff" stroke-width="1.5"/>`;
    zSvg += `<line x1="${zc}" y1="${zc-10}" x2="${zc}" y2="${zc+10}" stroke="#fff" stroke-width="1.5"/>`;
    zSvg += `<circle cx="${zc}" cy="${zc}" r="3" fill="none" stroke="#fff" stroke-width="1.2"/>`;
    // Săgețile existente în zoom
    endArrows.forEach(a => {
      if (a.xMm === undefined) return;
      const apx = (zc - offX*ZOOM_FACTOR) + a.xMm * zScale;
      const apy = (zc - offY*ZOOM_FACTOR) + a.yMm * zScale;
      zSvg += `<circle cx="${apx}" cy="${apy}" r="3" fill="${arrowDotColor(a.score)}" stroke="#fff" stroke-width="1"/>`;
    });
    zSvg += '</svg>';
    zoomEl.innerHTML = zSvg;
    zoomEl.classList.remove('hidden');
  };

  const handleImpact = (svgX, svgY) => {
    const dxMm = (svgX - CX) / scale;
    const dyMm = (svgY - CY) / scale;
    const distMm = Math.sqrt(dxMm*dxMm + dyMm*dyMm);
    const score = mmToScore(distMm, spec);
    const hour = xyToHour(dxMm, dyMm);
    addArrowGraphic(score, hour, dxMm, dyMm, distMm);
  };

  svg.addEventListener('click', e => {
    const {x,y} = getXY(e);
    handleImpact(x,y);
  });

  svg.addEventListener('mousemove', e => {
    const {x,y} = getXY(e);
    const d = svg.querySelector('#preview-dot');
    if(d){d.setAttribute('cx',x);d.setAttribute('cy',y);}
    updateZoom(x, y);
  });

  svg.addEventListener('mouseleave', () => {
    if(zoomEl) zoomEl.classList.add('hidden');
  });

  svg.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    const sx = SVG / rect.width, sy = SVG / rect.height;
    const x = (touch.clientX - rect.left) * sx;
    const y = (touch.clientY - rect.top) * sy;
    const d = svg.querySelector('#preview-dot');
    if(d){d.setAttribute('cx',x);d.setAttribute('cy',y);}
    updateZoom(x, y);
  }, { passive:false });

  svg.addEventListener('touchend', e => {
    e.preventDefault();
    // touchend: usa changedTouches (touches e gol la touchend)
    const touch = e.changedTouches[0];
    const rect = svg.getBoundingClientRect();
    const sx = SVG / rect.width, sy = SVG / rect.height;
    const x = (touch.clientX - rect.left) * sx;
    const y = (touch.clientY - rect.top) * sy;
    handleImpact(x, y);
    if(zoomEl) setTimeout(() => zoomEl.classList.add('hidden'), 1000);
  }, { passive:false });

  container.innerHTML = '';
  container.appendChild(svg);

  const lbl = document.createElement('div');
  lbl.className = 'graphic-target-label';
  lbl.textContent = `${spec.name} · inel = ${rw.toFixed(0)}mm`;
  container.appendChild(lbl);
}

function addArrowGraphic(score, hour, xMm, yMm, distMm) {
  const freeFormAdd = currentSession && currentSession.config.arrowsPerEnd === 0;
  if (!freeFormAdd) {
    const ape = currentArrowsPerEnd();
    if (endArrows.length >= ape) { toast('Seria completă! Salvează seria.'); return; }
  }
  endArrows.push({ score, position: hour,
    xMm: +xMm.toFixed(1), yMm: +yMm.toFixed(1), distMm: +distMm.toFixed(1) });
  renderGraphicTarget();
  updateEndUI();
  toast(`Sg.${endArrows.length}: ${score} · ora ${hour} · ${distMm.toFixed(0)}mm față de centru`, 'success');
}


// ── Grafic evoluție ────────────────────────────────────────
function renderEvolutionChart() {
  const el = document.getElementById('evolution-chart');
  if (!el) return;

  const trainings = sessions.filter(s => s.type === 'training' && s.ends && s.ends.length > 0);

  if (!trainings.length) {
    el.innerHTML = '<p class="evolution-empty">Niciun antrenament înregistrat încă.</p>';
    return;
  }

  const W = 340, H = 240;
  const PAD = { top: 16, right: 16, bottom: 32, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // X = numarul seriei, Y = punctajul
  let maxEnds = 0, maxScore = 0, minScore = Infinity;
  trainings.forEach(s => {
    s.ends.forEach(end => {
      if ((end.endNumber||1) > maxEnds) maxEnds = end.endNumber||1;
      if (end.total > maxScore) maxScore = end.total;
      if (end.total < minScore) minScore = end.total;
    });
  });
  maxScore = Math.ceil(maxScore / 5) * 5;
  minScore = Math.max(0, Math.floor((minScore - 2) / 5) * 5);
  if (maxEnds < 2) maxEnds = 2;

  // scX = pozitia orizontala a seriei N
  const scX = n => PAD.left + (n - 1) / Math.max(maxEnds - 1, 1) * plotW;
  // scY = pozitia verticala a punctajului (sus = mai mare)
  const scY = score => PAD.top + plotH - (score - minScore) / (maxScore - minScore) * plotH;

  const COLORS = ['#e8c44a','#3b82f6','#a855f7','#10b981','#f97316',
                  '#ef4444','#06b6d4','#84cc16','#f59e0b','#8b5cf6'];

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" class="evolution-svg">`;
  svg += `<rect width="${W}" height="${H}" fill="var(--bg2)" rx="10"/>`;

  // Grid orizontal (punctaj)
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const score = minScore + (maxScore - minScore) * i / yTicks;
    const y = scY(score);
    svg += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + plotW}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
    svg += `<text x="${PAD.left - 4}" y="${y + 3}" text-anchor="end" fill="var(--text-dim)" font-size="9" font-family="monospace">${Math.round(score)}</text>`;
  }

  // Grid vertical (serii)
  for (let e = 1; e <= maxEnds; e++) {
    const x = scX(e);
    svg += `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top + plotH}" stroke="var(--border)" stroke-width="0.3"/>`;
    if (e === 1 || e % Math.ceil(maxEnds / 8) === 0 || e === maxEnds) {
      svg += `<text x="${x}" y="${PAD.top + plotH + 14}" text-anchor="middle" fill="var(--text-dim)" font-size="9" font-family="monospace">S${e}</text>`;
    }
  }

  // Axe
  svg += `<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + plotH}" stroke="var(--border)" stroke-width="1"/>`;
  svg += `<line x1="${PAD.left}" y1="${PAD.top + plotH}" x2="${PAD.left + plotW}" y2="${PAD.top + plotH}" stroke="var(--border)" stroke-width="1"/>`;

  // Etichete axe
  svg += `<text x="${PAD.left + plotW/2}" y="${H - 2}" text-anchor="middle" fill="var(--text-dim)" font-size="8">Seria</text>`;
  svg += `<text x="8" y="${PAD.top + plotH/2}" text-anchor="middle" fill="var(--text-dim)" font-size="8" transform="rotate(-90,8,${PAD.top + plotH/2})">Punctaj</text>`;

  // Linii per antrenament (cele mai recente 10)
  const toShow = trainings.slice().reverse().slice(0, 10);
  toShow.forEach((session, si) => {
    const col = COLORS[si % COLORS.length];
    const date = new Date(session.date).toLocaleDateString('ro-RO', {day:'2-digit', month:'2-digit'});
    const ends = session.ends.slice().sort((a, b) => (a.endNumber||0) - (b.endNumber||0));

    // Linie
    if (ends.length > 1) {
      const points = ends.map(end => `${scX(end.endNumber||1).toFixed(1)},${scY(end.total).toFixed(1)}`).join(' ');
      svg += `<polyline points="${points}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
    }

    // Puncte
    ends.forEach(end => {
      const x = scX(end.endNumber||1), y = scY(end.total);
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${col}" stroke="var(--bg2)" stroke-width="1"/>`;
    });

    // Label data langa ultima serie
    if (ends.length > 0) {
      const lastEnd = ends[ends.length - 1];
      const lx = scX(lastEnd.endNumber||1) + 4;
      const ly = scY(lastEnd.total) + 3;
      svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${col}" font-size="7" font-family="monospace">${date}</text>`;
    }
  });

  svg += '</svg>';
  el.innerHTML = svg;
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

    // Nr maxim săgeți per serie (dinamic)
    const maxArr = Math.max(...s.ends.map(e => e.arrows.length), 1);
    const hdrRow = ['Seria'];
    for (let h = 1; h <= maxArr; h++) { hdrRow.push(`Săgeată ${h}`, `Pos ${h}`); }
    hdrRow.push('Total serie');

    const rows = [
      ['Tip', s.type === 'training' ? 'Antrenament' : 'Concurs'],
      ['Arc', s.bow?.name || ''],
      ['Putere (lbs)', s.bow?.poundage || ''],
      ['Data', new Date(s.date).toLocaleString('ro-RO')],
      ['Distanță (m)', s.config.distance || ''],
      ['Tip țintă', s.config.target || ''],
      [],
      hdrRow
    ];

    s.ends.forEach(end => {
      const row = [end.endNumber];
      for (let i = 0; i < maxArr; i++) {
        const a = end.arrows[i];
        row.push(a ? a.score : '');
        row.push(a?.position ? `${a.position}h` : '');
      }
      row.push(end.total);
      rows.push(row);
    });

    const emptyTotal = ['TOTAL'];
    for (let t = 0; t < maxArr * 2; t++) emptyTotal.push('');
    emptyTotal.push(s.totalScore || 0);
    rows.push([]);
    rows.push(emptyTotal);
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
  if (!url.endsWith('/exec')) {
    showTestResult('error', '⚠ URL-ul trebuie să se termine cu /exec');
    return;
  }
  scriptUrl = url;
  saveScriptConfig();

  // Cu no-cors nu putem citi răspunsul, dar verificăm că fetch ajunge la server
  showTestResult('loading', '⏳ Trimit test către Google Script...');
  setSyncState('syncing', 'Testez conexiunea...');
  try {
    // no-cors: browserul trimite request-ul dar nu ne dă acces la răspuns
    // Dacă nu aruncă eroare => serverul a primit datele
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ _test: true, date: new Date().toISOString() })
    });
    // Cu no-cors răspunsul e opaque — considerăm că a mers dacă nu a aruncat eroare
    showTestResult('ok', '✓ URL salvat! Testul a fost trimis către Google Script. Verifică că apare o foaie nouă în Google Sheets după prima sesiune reală.');
    setSyncState('ok', 'Conectat — URL salvat, sincronizare activă');
    updateSyncStatusBar();
    toast('✓ Google Sheets configurat!', 'success');
    if (pendingSync.length > 0) {
      setTimeout(() => syncAllPending(), 500);
    }
  } catch(err) {
    showTestResult('error', '✗ Eroare rețea: ' + err.message + ' — verifică URL-ul și deployment-ul.');
    setSyncState('error', 'Eroare rețea');
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
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'save', session })
    });
    pendingSync = pendingSync.filter(id => id !== session.id);
    // Estimăm numele foii (același algoritm ca în Apps Script)
    if (!session.sheetName) {
      const date = new Date(session.date);
      const dd = String(date.getDate()).padStart(2,'0');
      const mm = String(date.getMonth()+1).padStart(2,'0');
      const yyyy = date.getFullYear();
      const dateStr = `${dd}-${mm}-${yyyy}`;
      const type = session.type === 'training' ? 'Ant' : 'Cnc';
      const bow = (session.bow?.name || 'Arc').substring(0,12).replace(/[\/\?*[\]'"]/g,'');
      const dist = session.config?.distance ? session.config.distance + 'm' : '';
      session.sheetName = `${type}_${bow}${dist ? '_'+dist : ''}_${dateStr}`.substring(0,90);
      // Actualizăm în lista de sesiuni
      const idx = sessions.findIndex(s => s.id === session.id);
      if (idx !== -1) { sessions[idx].sheetName = session.sheetName; save(); }
    }
    saveScriptConfig();
    setSyncState('ok', '✓ Date trimise către Google Sheets');
    toast('✓ Salvat în Google Sheets!', 'success');
  } catch(err) {
    console.error('Sync error:', err);
    if (!pendingSync.includes(session.id)) {
      pendingSync.push(session.id);
      saveScriptConfig();
    }
    setSyncState('error', '✗ Eroare rețea — date salvate local');
    toast('Eroare rețea — sesiunea e salvată local', 'error');
  }
}

async function deleteFromGoogleSheets(session) {
  if (!scriptUrl || !session.sheetName) return;
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'delete',
        sheetName: session.sheetName,
        sessionDate: session.date,
        sessionId: session.id
      })
    });
    // Cu no-cors nu putem confirma, dar trimitem comanda
  } catch(err) {
    console.error('Delete from Sheets error:', err);
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

// ── Draft Recovery ────────────────────────────────────────
function showDraftRecovery(draft) {
  const session = draft.session;
  const date = new Date(session.date);
  const dateStr = date.toLocaleDateString('ro-RO');
  const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  const savedAt = new Date(draft.savedAt);
  const savedStr = savedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  const type = session.type === 'training' ? 'Antrenament' : 'Concurs';
  const dist = session.config?.distance ? ` · ${session.config.distance}m` : '';
  const ends = session.ends?.length || 0;
  const arrowsInProgress = draft.endArrows?.length || 0;

  const modal = document.createElement('div');
  modal.id = 'modal-draft-recovery';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">📋 Sesiune neterminată</div>
      <div class="draft-info">
        <div class="draft-row">
          <span class="draft-label">Tip</span>
          <span class="draft-value">${type}</span>
        </div>
        <div class="draft-row">
          <span class="draft-label">Arc</span>
          <span class="draft-value">${session.bow?.name || '—'}${dist}</span>
        </div>
        <div class="draft-row">
          <span class="draft-label">Data</span>
          <span class="draft-value">${dateStr} ${timeStr}</span>
        </div>
        <div class="draft-row">
          <span class="draft-label">Serii salvate</span>
          <span class="draft-value">${ends} serii complete</span>
        </div>
        ${arrowsInProgress > 0 ? `
        <div class="draft-row">
          <span class="draft-label">În progres</span>
          <span class="draft-value">${arrowsInProgress} săgeți în seria curentă</span>
        </div>` : ''}
        <div class="draft-row">
          <span class="draft-label">Salvat la</span>
          <span class="draft-value">${savedStr}</span>
        </div>
      </div>
      <p class="draft-hint">Vrei să continui această sesiune sau să o abandonezi?</p>
      <div class="modal-actions" style="justify-content:space-between">
        <button class="btn-danger-sm" onclick="abandonDraft()">🗑 Abandonează</button>
        <button class="btn-primary" onclick="resumeDraft()">▶ Continuă sesiunea</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function resumeDraft() {
  const draft = loadDraft();
  if (!draft) return;
  document.getElementById('modal-draft-recovery')?.remove();

  currentSession = draft.session;
  currentEndIndex = draft.currentEndIndex || 0;
  endArrows = draft.endArrows || [];
  editingArrowIndex = -1;

  initSessionUI();
  toast('Sesiune reluată ✓', 'success');
}

function abandonDraft() {
  if (!confirm('Abandonezi sesiunea neterminată? Datele se pierd definitiv.')) return;
  clearDraft();
  document.getElementById('modal-draft-recovery')?.remove();
  toast('Sesiune abandonată');
}

// ── PWA Install ───────────────────────────────────────────
let deferredInstallPrompt = null;
const INSTALL_DISMISSED_KEY = 'archery_install_dismissed';

function initInstallPrompt() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;

  // Dacă e deja instalat, nu mai arătăm nimic
  if (isStandalone) return;

  // iOS — browserul nu oferă eveniment, arătăm instrucțiuni manuale
  if (isIOS) {
    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!dismissed) {
      // Arată bannerul după 3 secunde
      setTimeout(() => showIOSBanner(), 3000);
    }
    return;
  }

  // Android/Chrome — ascultă evenimentul beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!dismissed) {
      setTimeout(() => showAndroidBanner(), 2000);
    }

    // Arată și butonul din header
    document.getElementById('install-btn')?.classList.remove('hidden');
  });

  // Ascultă instalarea reușită
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.getElementById('install-btn')?.classList.add('hidden');
    document.getElementById('install-banner')?.classList.add('hidden');
    toast('✓ Aplicație instalată!', 'success');
  });
}

function showAndroidBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('hidden');
}

function showIOSBanner() {
  // Pe iOS arătăm direct modalul cu instrucțiuni
  document.getElementById('modal-ios-install')?.classList.remove('hidden');
}

function installApp() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    showIOSBanner();
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        toast('✓ Instalare în curs...', 'success');
      }
      deferredInstallPrompt = null;
      document.getElementById('install-btn')?.classList.add('hidden');
      document.getElementById('install-banner')?.classList.add('hidden');
    });
  }
}

function dismissInstallBanner() {
  document.getElementById('install-banner')?.classList.add('hidden');
  document.getElementById('install-btn')?.classList.add('hidden');
  // Nu mai arăta timp de 7 zile
  localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
  // Dar permite re-afișarea după 7 zile
  setTimeout(() => localStorage.removeItem(INSTALL_DISMISSED_KEY), 7 * 24 * 60 * 60 * 1000);
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
