// ── Archery Scorer — Google Apps Script v2 ───────────────
// Lipește acest cod în Extensions → Apps Script din Google Sheets
// Deploy → New deployment → Web App → Execute as: Me → Anyone → Deploy

var SUMMARY_SHEET = 'Statistici All-Time';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── 1. Creează / actualizează foaia de statistici all-time ──
    updateSummarySheet(ss, data);

    // ── 2. Creează foaia pentru sesiunea curentă ──
    var sheetName = buildSheetName(data);
    var sheet = ss.insertSheet(sheetName, ss.getNumSheets()); // adaugă la sfârșit

    writeSessionToSheet(sheet, data);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', sheet: sheetName }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Archery Scorer Script activ' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Construiește numele foii sesiunii ──────────────────────
function buildSheetName(data) {
  var date = new Date(data.date);
  var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MM-yyyy');
  var type = data.type === 'training' ? 'Ant' : 'Cnc';
  var bowName = (data.bow && data.bow.name) ? data.bow.name.substring(0, 12) : 'Arc';
  var dist = (data.config && data.config.distance) ? data.config.distance + 'm' : '';
  var base = (type + '_' + bowName + (dist ? '_' + dist : '') + '_' + dateStr)
             .replace(/[\/\?\*\[\]:'"]/g, '').substring(0, 90);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = base;
  var n = 1;
  while (ss.getSheetByName(name)) { name = base + '_' + (++n); }
  return name;
}

// ── Scrie datele sesiunii pe o foaie ──────────────────────
function writeSessionToSheet(sheet, data) {
  var ends = data.ends || [];
  var allArrows = [];
  ends.forEach(function(end) { (end.arrows || []).forEach(function(a){ allArrows.push(a); }); });

  var totalScore = data.totalScore || 0;
  var totalXs    = data.totalXs   || 0;
  var totalArr   = data.totalArrows || allArrows.length;
  var avg        = totalArr > 0 ? (totalScore / totalArr).toFixed(2) : 0;
  var best       = 0;
  ends.forEach(function(end){ if ((end.total||0) > best) best = end.total; });

  // ── Bloc info sesiune ──
  var info = [
    ['Tip sesiune',   data.type === 'training' ? 'Antrenament' : 'Concurs'],
    ['Arc',           (data.bow && data.bow.name) ? data.bow.name : ''],
    ['Putere (lbs)',  (data.bow && data.bow.poundage) ? data.bow.poundage : ''],
    ['Tip arc',       (data.bow && data.bow.type) ? data.bow.type : ''],
    ['Data',          Utilities.formatDate(new Date(data.date), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm')],
    ['Distanță (m)',  (data.config && data.config.distance) ? data.config.distance : ''],
    ['Tip țintă',     (data.config && data.config.target) ? data.config.target : ''],
  ];
  if (data.type === 'competition' && data.competition) {
    info.push(['Competiție', data.competition.name || '']);
  }

  var row = 1;
  info.forEach(function(r) {
    sheet.getRange(row, 1, 1, 2).setValues([r]);
    row++;
  });
  row++; // linie goală

  // ── Statistici sesiune ──
  var stats = [
    ['── STATISTICI SESIUNE ──', ''],
    ['Total puncte',    totalScore],
    ['X-uri',           totalXs],
    ['Săgeți trase',    totalArr],
    ['Serii',           ends.length],
    ['Medie/săgeată',   parseFloat(avg)],
    ['Cel mai bun end', best],
  ];
  stats.forEach(function(r) {
    sheet.getRange(row, 1, 1, 2).setValues([r]);
    if (r[0].indexOf('──') !== -1) {
      var hdr = sheet.getRange(row, 1, 1, 2);
      hdr.setBackground('#1a1a2e'); hdr.setFontColor('#e8c44a'); hdr.setFontWeight('bold');
    }
    row++;
  });
  row++;

  // ── Tabel serii ──
  var tableHdr = ['Seria', 'Sg.1', 'Pos.1', 'Sg.2', 'Pos.2', 'Sg.3', 'Pos.3',
                  'Sg.4', 'Pos.4', 'Sg.5', 'Pos.5', 'Sg.6', 'Pos.6', 'Total serie'];
  sheet.getRange(row, 1, 1, tableHdr.length).setValues([tableHdr]);
  var hdrRange = sheet.getRange(row, 1, 1, tableHdr.length);
  hdrRange.setBackground('#2e3452'); hdrRange.setFontColor('#e8c44a'); hdrRange.setFontWeight('bold');
  row++;

  ends.forEach(function(end, idx) {
    var r = [end.endNumber || idx + 1];
    for (var i = 0; i < 6; i++) {
      var a = end.arrows && end.arrows[i];
      r.push(a ? a.score : '');
      r.push(a && a.position ? a.position + 'h' : '');
    }
    r.push(end.total || 0);
    sheet.getRange(row, 1, 1, r.length).setValues([r]);
    if (idx % 2 === 0) sheet.getRange(row, 1, 1, r.length).setBackground('#1e2338');
    row++;
  });

  // Total row
  var totRow = ['TOTAL', '', '', '', '', '', '', '', '', '', '', '', '', totalScore];
  sheet.getRange(row, 1, 1, totRow.length).setValues([totRow]);
  var totRange = sheet.getRange(row, 1, 1, totRow.length);
  totRange.setBackground('#e8c44a'); totRange.setFontColor('#111'); totRange.setFontWeight('bold');

  sheet.autoResizeColumns(1, 14);
}

// ── Actualizează foaia Statistici All-Time ─────────────────
function updateSummarySheet(ss, newSession) {
  var sheet = ss.getSheetByName(SUMMARY_SHEET);
  if (!sheet) {
    // Creează foaia și pune-o prima
    sheet = ss.insertSheet(SUMMARY_SHEET, 0);
    writeSummaryHeaders(sheet);
  }

  // Adaugă rândul pentru noua sesiune
  var ends   = newSession.ends || [];
  var arrows = [];
  ends.forEach(function(e){ (e.arrows||[]).forEach(function(a){ arrows.push(a); }); });
  var total  = newSession.totalScore || 0;
  var xs     = newSession.totalXs   || 0;
  var cnt    = newSession.totalArrows || arrows.length;
  var avg    = cnt > 0 ? parseFloat((total/cnt).toFixed(2)) : 0;
  var best   = 0;
  ends.forEach(function(e){ if((e.total||0)>best) best=e.total; });
  var date   = Utilities.formatDate(new Date(newSession.date), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm');
  var bow    = (newSession.bow && newSession.bow.name) ? newSession.bow.name : '';
  var dist   = (newSession.config && newSession.config.distance) ? newSession.config.distance + 'm' : '';
  var type   = newSession.type === 'training' ? 'Antrenament' : 'Concurs';
  var comp   = (newSession.competition && newSession.competition.name) ? newSession.competition.name : '';

  var newRow = [date, type, bow, dist, ends.length, cnt, total, xs, avg, best, comp];

  // Găsește primul rând liber după header
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);

  // Recalculează totalurile din rândul 3 (rândul de sumar)
  updateSummaryTotals(sheet);
  sheet.autoResizeColumns(1, 11);
}

function writeSummaryHeaders(sheet) {
  // Titlu
  sheet.getRange(1, 1, 1, 11).merge()
       .setValue('ARCHERY SCORER — STATISTICI ALL-TIME')
       .setBackground('#1a1a2e').setFontColor('#e8c44a')
       .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 32);

  // Header coloane
  var hdr = ['Data', 'Tip', 'Arc', 'Distanță', 'Serii', 'Săgeți', 'Total', 'X-uri', 'Medie/↗', 'Best End', 'Competiție'];
  sheet.getRange(2, 1, 1, hdr.length).setValues([hdr])
       .setBackground('#2e3452').setFontColor('#e8c44a').setFontWeight('bold');

  // Rând sumar (calculat dinamic) — lăsat gol inițial, completat de updateSummaryTotals
  sheet.getRange(3, 1, 1, 11).setBackground('#0f1117').setFontColor('#7a84a8');
}

function updateSummaryTotals(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) return; // Nu sunt date încă

  // Citește toate rândurile de date (de la 4 în jos, rândul 3 e sumar)
  var dataRange = sheet.getRange(4, 1, lastRow - 3, 11);
  var data = dataRange.getValues();

  var totalSess = data.length;
  var totalEnds = 0, totalArr = 0, totalPts = 0, totalXs = 0, bestEnd = 0;
  var sumAvg = 0;
  data.forEach(function(r) {
    totalEnds += r[4] || 0;
    totalArr  += r[5] || 0;
    totalPts  += r[6] || 0;
    totalXs   += r[7] || 0;
    if ((r[9]||0) > bestEnd) bestEnd = r[9];
    sumAvg    += r[8] || 0;
  });
  var globalAvg = totalArr > 0 ? parseFloat((totalPts/totalArr).toFixed(2)) : 0;

  var sumRow = [
    'TOTAL (' + totalSess + ' sesiuni)',
    '', '', '',
    totalEnds, totalArr, totalPts, totalXs, globalAvg, bestEnd, ''
  ];
  sheet.getRange(3, 1, 1, sumRow.length).setValues([sumRow])
       .setBackground('#e8c44a').setFontColor('#111').setFontWeight('bold');
}
