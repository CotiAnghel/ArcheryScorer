// ── Archery Scorer — Google Apps Script v3 ───────────────
// Deploy → New deployment → Web App → Execute as: Me → Anyone → Deploy

var SUMMARY_SHEET = 'Statistici All-Time';

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'save';

    if (action === 'delete') {
      return handleDelete(payload);
    } else {
      return handleSave(payload.session || payload);
    }
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

// ── SAVE ──────────────────────────────────────────────────
function handleSave(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  updateSummarySheet(ss, data);
  var sheetName = buildSheetName(ss, data);
  var sheet = ss.insertSheet(sheetName, ss.getNumSheets());
  writeSessionToSheet(sheet, data);
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', sheet: sheetName }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── DELETE ────────────────────────────────────────────────
function handleDelete(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = payload.sheetName;

  // Șterge foaia sesiunii
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    ss.deleteSheet(sheet);
  }

  // Șterge rândul din foaia all-time (caută după dată și ID)
  var summary = ss.getSheetByName(SUMMARY_SHEET);
  if (summary && payload.sessionDate) {
    var date = new Date(payload.sessionDate);
    var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MM-yyyy');
    var lastRow = summary.getLastRow();
    if (lastRow >= 4) {
      var data = summary.getRange(4, 1, lastRow - 3, 11).getValues();
      for (var i = data.length - 1; i >= 0; i--) {
        var rowDateStr = data[i][0] ? data[i][0].toString().substring(0, 10) : '';
        if (rowDateStr === dateStr) {
          summary.deleteRow(i + 4); // +4 offset (header rows)
          break;
        }
      }
    }
    // Recalculează totalurile
    updateSummaryTotals(summary);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', deleted: sheetName }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Build sheet name ──────────────────────────────────────
function buildSheetName(ss, data) {
  var date = new Date(data.date);
  var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MM-yyyy');
  var type = data.type === 'training' ? 'Ant' : 'Cnc';
  var bowName = (data.bow && data.bow.name) ? data.bow.name.substring(0, 12) : 'Arc';
  var dist = (data.config && data.config.distance) ? data.config.distance + 'm' : '';
  var base = (type + '_' + bowName + (dist ? '_' + dist : '') + '_' + dateStr)
             .replace(/[\/\\\?\*\[\]\:\'\"]/g, '').substring(0, 90);
  var name = base;
  var n = 1;
  while (ss.getSheetByName(name)) { name = base + '_' + (++n); }
  return name;
}

// ── Write session sheet ───────────────────────────────────
function writeSessionToSheet(sheet, data) {
  var ends = data.ends || [];
  var allArrows = [];
  ends.forEach(function(end) { (end.arrows || []).forEach(function(a){ allArrows.push(a); }); });
  var totalScore = data.totalScore || 0;
  var totalXs    = data.totalXs   || 0;
  var totalArr   = data.totalArrows || allArrows.length;
  var avg        = totalArr > 0 ? parseFloat((totalScore / totalArr).toFixed(2)) : 0;
  var best = 0;
  ends.forEach(function(end){ if ((end.total||0) > best) best = end.total; });

  var info = [
    ['Tip sesiune',  data.type === 'training' ? 'Antrenament' : 'Concurs'],
    ['Arc',          (data.bow && data.bow.name) ? data.bow.name : ''],
    ['Putere (lbs)', (data.bow && data.bow.poundage) ? data.bow.poundage : ''],
    ['Tip arc',      (data.bow && data.bow.type) ? data.bow.type : ''],
    ['Data',         Utilities.formatDate(new Date(data.date), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm')],
    ['Distanta (m)', (data.config && data.config.distance) ? data.config.distance : ''],
    ['Tip tinta',    (data.config && data.config.target) ? data.config.target : ''],
  ];
  if (data.type === 'competition' && data.competition) {
    info.push(['Competitie', data.competition.name || '']);
  }

  var row = 1;
  info.forEach(function(r) {
    var infoRange = sheet.getRange(row, 1, 1, 2);
    infoRange.setValues([r]);
    infoRange.setFontColor('#1a1a2e');
    infoRange.setBackground('#ffffff');
    row++;
  });
  row++;

  var stats = [
    ['── STATISTICI SESIUNE ──', ''],
    ['Total puncte',   totalScore],
    ['X-uri',          totalXs],
    ['Sageti trase',   totalArr],
    ['Serii',          ends.length],
    ['Medie/sageata',  avg],
    ['Cel mai bun end',best],
  ];
  stats.forEach(function(r) {
    var statRange = sheet.getRange(row, 1, 1, 2);
    statRange.setValues([r]);
    if (r[0].indexOf('──') !== -1) {
      statRange.setBackground('#1a1a2e');
      statRange.setFontColor('#e8c44a');
      statRange.setFontWeight('bold');
    } else {
      statRange.setBackground('#f8f9fa');
      statRange.setFontColor('#1a1a2e');
    }
    row++;
  });
  row++;

  // Calculează numărul maxim de săgeți per serie (dinamic)
  var maxArrows = 0;
  ends.forEach(function(end) {
    var cnt = (end.arrows || []).length;
    if (cnt > maxArrows) maxArrows = cnt;
  });
  if (maxArrows === 0) maxArrows = 6;

  var tableStartRow = row;
  var tableStartCol = 1;

  // Header dinamic
  var tableHdr = ['Seria'];
  for (var h = 1; h <= maxArrows; h++) {
    tableHdr.push('Sg.' + h);
    tableHdr.push('Poz.' + h);
  }
  tableHdr.push('Total serie');
  sheet.getRange(row, 1, 1, tableHdr.length).setValues([tableHdr]);
  var hdrRange = sheet.getRange(row, 1, 1, tableHdr.length);
  hdrRange.setBackground('#2e3452'); hdrRange.setFontColor('#e8c44a'); hdrRange.setFontWeight('bold');
  hdrRange.setHorizontalAlignment('center');
  row++;

  var firstDataRow = row;
  ends.forEach(function(end, idx) {
    var r = [end.endNumber || idx + 1];
    for (var i = 0; i < maxArrows; i++) {
      var a = end.arrows && end.arrows[i];
      r.push(a ? a.score : '');
      r.push(a && a.position ? a.position + 'h' : '');
    }
    r.push(end.total || 0);
    sheet.getRange(row, 1, 1, r.length).setValues([r]);
    var rowRange = sheet.getRange(row, 1, 1, r.length);
    if (idx % 2 === 0) {
      rowRange.setBackground('#e8f0fe');
    } else {
      rowRange.setBackground('#ffffff');
    }
    rowRange.setFontColor('#1a1a2e');
    rowRange.setHorizontalAlignment('center');
    row++;
  });
  var lastDataRow = row - 1;

  var totRow = ['TOTAL'];
  for (var t = 0; t < maxArrows * 2; t++) totRow.push('');
  totRow.push(totalScore);
  sheet.getRange(row, 1, 1, totRow.length).setValues([totRow]);
  var totRange = sheet.getRange(row, 1, 1, totRow.length);
  totRange.setBackground('#e8c44a'); totRange.setFontColor('#111'); totRange.setFontWeight('bold');
  totRange.setHorizontalAlignment('center');

  // ── Formatare vizuală: grupare Săgeată+Poziție ──────────
  formatArrowTable(sheet, tableStartRow, firstDataRow, lastDataRow, maxArrows);

  // ── Centraj per serie și per sesiune ────────────────────
  var centrajStartRow = row + 2;
  writeCentrajSection(sheet, centrajStartRow, ends);
}

function writeCentrajSection(sheet, startRow, ends) {
  var SCORE_RADIUS = { 'X': 0, '10': 0.5, '9': 1.5, '8': 2.5, '7': 3.5,
    '6': 4.5, '5': 5.5, '4': 6.5, '3': 7.5, '2': 8.5, '1': 9.5, 'M': 10.5 };

  function arrowToXY(score, position) {
    var r = SCORE_RADIUS[String(score)];
    if (r === undefined) r = 5.0;
    if (r === 0 || !position) return { x: 0, y: 0 };
    var angleDeg = (parseInt(position) / 12.0) * 360.0;
    var angleRad = angleDeg * Math.PI / 180;
    return { x: r * Math.sin(angleRad), y: -r * Math.cos(angleRad) };
  }

  function groupCenter(arrows) {
    var valid = arrows.filter(function(a) { return a.score !== 'M' && a.position; });
    if (!valid.length) return null;
    var coords = valid.map(function(a) { return arrowToXY(a.score, a.position); });
    var cx = coords.reduce(function(s,c){return s+c.x;},0)/coords.length;
    var cy = coords.reduce(function(s,c){return s+c.y;},0)/coords.length;
    var spread = Math.sqrt(coords.reduce(function(s,c){
      return s+(c.x-cx)*(c.x-cx)+(c.y-cy)*(c.y-cy);
    },0)/coords.length);
    var dist = Math.sqrt(cx*cx+cy*cy);
    var angleDeg = ((Math.atan2(cx,-cy)*180/Math.PI)+360)%360;
    var hour = ((angleDeg/360*12)%12)||12;
    var dirLabels = {12:'sus',1:'sus-dreapta',2:'sus-dreapta',3:'dreapta',
      4:'jos-dreapta',5:'jos-dreapta',6:'jos',7:'jos-stanga',8:'jos-stanga',
      9:'stanga',10:'sus-stanga',11:'sus-stanga'};
    var dir = dist < 0.5 ? 'centrat' : (dirLabels[Math.round(hour)]||'—')+' ('+Math.round(hour)+'h)';
    return { cx: Math.round(cx*100)/100, cy: Math.round(cy*100)/100,
             spread: Math.round(spread*100)/100, dist: Math.round(dist*100)/100,
             dir: dir, count: valid.length };
  }

  var row = startRow;

  // Header secțiune
  var hdrRange = sheet.getRange(row, 1, 1, 6);
  hdrRange.merge().setValue('CENTRAJ GRUP');
  hdrRange.setBackground('#1a1a2e').setFontColor('#e8c44a').setFontWeight('bold');
  row++;

  // Header tabel
  var colHdr = ['Seria', 'Sageti', 'X (dr/st)', 'Y (jos/sus)', 'Distanta', 'Directie eroare'];
  sheet.getRange(row, 1, 1, colHdr.length).setValues([colHdr])
       .setBackground('#2e3452').setFontColor('#e8c44a').setFontWeight('bold')
       .setHorizontalAlignment('center');
  row++;

  // Per serie
  var allArrows = [];
  ends.forEach(function(end, idx) {
    var arrows = end.arrows || [];
    allArrows = allArrows.concat(arrows);
    var c = groupCenter(arrows);
    if (!c) return;
    var r = [end.endNumber || idx+1, c.count,
             c.cx > 0 ? '+'+c.cx+' (dr)' : c.cx < 0 ? c.cx+' (st)' : '0',
             c.cy > 0 ? '+'+c.cy+' (jos)' : c.cy < 0 ? c.cy+' (sus)' : '0',
             c.dist, c.dir];
    var dataRange = sheet.getRange(row, 1, 1, r.length);
    dataRange.setValues([r]).setHorizontalAlignment('center');
    if (idx % 2 === 0) {
      dataRange.setBackground('#e8f0fe').setFontColor('#1a1a2e');
    } else {
      dataRange.setBackground('#ffffff').setFontColor('#1a1a2e');
    }
    row++;
  });

  // Total sesiune
  var sc = groupCenter(allArrows);
  if (sc) {
    var totRow2 = ['SESIUNE', sc.count,
      sc.cx > 0 ? '+'+sc.cx+' (dr)' : sc.cx < 0 ? sc.cx+' (st)' : '0',
      sc.cy > 0 ? '+'+sc.cy+' (jos)' : sc.cy < 0 ? sc.cy+' (sus)' : '0',
      sc.dist, sc.dir];
    sheet.getRange(row, 1, 1, totRow2.length).setValues([totRow2])
         .setBackground('#e8c44a').setFontColor('#111').setFontWeight('bold')
         .setHorizontalAlignment('center');
  }
  sheet.setColumnWidth(6, 140);

  // ── Grafic vizual centraj ca SVG în sheet ──────────────
  if (sc) {
    drawCentrajChart(sheet, row + 2, ends, sc);
  }
}

function drawCentrajChart(sheet, startRow, ends, sessionCenter) {
  var SCORE_RADIUS = { 'X': 0, '10': 0.5, '9': 1.5, '8': 2.5, '7': 3.5,
    '6': 4.5, '5': 5.5, '4': 6.5, '3': 7.5, '2': 8.5, '1': 9.5, 'M': 10.5 };

  // Colectează coordonate
  var points = [];
  var hasExact = false;
  ends.forEach(function(end, ei) {
    (end.arrows || []).forEach(function(a) {
      if (a.score === 'M') return;
      var x, y;
      if (a.xMm !== undefined) {
        x = a.xMm; y = a.yMm; hasExact = true;
      } else if (a.position) {
        var r = (SCORE_RADIUS[String(a.score)] || 5) * 10;
        var rad = (parseInt(a.position) / 12.0) * 2 * Math.PI;
        x = r * Math.sin(rad); y = -r * Math.cos(rad);
      } else { return; }
      points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
                    score: a.score, serie: end.endNumber || ei + 1 });
    });
  });

  if (points.length === 0) return;

  var dataStart = startRow + 2;

  // Header secțiune
  var hdrCell = sheet.getRange(startRow, 1, 1, 4);
  hdrCell.merge().setValue('GRAFIC CENTRAJ GRUP');
  hdrCell.setBackground('#1a1a2e').setFontColor('#e8c44a').setFontWeight('bold');

  // Header tabel date cu 3 serii: sageti, centru grup, centru tinta  sheet.getRange(dataStart, 1, 1, 6).setValues(    [['X sageti', 'Y sageti', 'X centru', 'Y centru', 'X tinta', 'Y tinta']])    .setBackground('#2e3452').setFontColor('#e8c44a').setFontWeight('bold');  // Centru sesiune  var cx = sessionCenter ? sessionCenter.cx : 0;  var cy = sessionCenter ? sessionCenter.cy : 0;  if (!hasExact) { cx = cx * 10; cy = cy * 10; }  cx = Math.round(cx * 10) / 10;  cy = Math.round(cy * 10) / 10;  // Rânduri de date  var tableRows = [];  points.forEach(function(p, i) {    tableRows.push([      p.x, p.y,      i === 0 ? cx : null,      i === 0 ? cy : null,      i === 0 ? 0 : null,      i === 0 ? 0 : null    ]);  });  sheet.getRange(dataStart + 1, 1, tableRows.length, 6).setValues(tableRows);  // Grafic scatter cu 3 serii  try {    var nRows = tableRows.length + 1;    var chart = sheet.newChart()      .setChartType(Charts.ChartType.SCATTER)      .addRange(sheet.getRange(dataStart, 1, nRows, 2))      .addRange(sheet.getRange(dataStart, 3, 2, 2))      .addRange(sheet.getRange(dataStart, 5, 2, 2))      .setOption('title', hasExact ? 'Centraj grup (mm exacti)' : 'Centraj grup (estimat)')      .setOption('hAxis', { title: 'Stanga (-) / Dreapta (+) mm', gridlines: {count: 5} })      .setOption('vAxis', { title: 'Jos (-) / Sus (+) mm', gridlines: {count: 5} })      .setOption('legend', { position: 'right' })      .setOption('series', {        0: { color: '#e8a800', pointSize: 7  },        1: { color: '#ef4444', pointSize: 14 },        2: { color: '#333333', pointSize: 10 }      })      .setOption('width', 460)      .setOption('height', 400)      .setPosition(startRow, 8, 0, 0)      .build();    sheet.insertChart(chart);  } catch(err) {    var errCell = sheet.getRange(startRow + 1, 8, 1, 3);    errCell.merge().setValue('EROARE GRAFIC: ' + err.message);    errCell.setBackground('#ffcccc').setFontColor('#cc0000').setFontWeight('bold');    errCell.setWrap(true);  }}

// ── Formatare tabel săgeți: lățimi egale + grupare vizuală ──
function formatArrowTable(sheet, headerRow, firstDataRow, lastDataRow, maxArrows) {
  var totalRow = lastDataRow + 1;

  // Coloana 1 (Seria) — mai lată, ușor de citit
  sheet.setColumnWidth(1, 90);

  // Pentru fiecare pereche Sg./Poz. — lățimi egale, fundal ușor diferit pt poziție
  for (var i = 0; i < maxArrows; i++) {
    var scoreCol = 2 + (i * 2);      // coloana scorului
    var posCol   = scoreCol + 1;      // coloana poziției

    sheet.setColumnWidth(scoreCol, 55);
    sheet.setColumnWidth(posCol, 55);

    // Fundal ușor diferit pentru coloana de poziție (să se distingă de scor)
    var posRange = sheet.getRange(firstDataRow, posCol, lastDataRow - firstDataRow + 1, 1);
    var existingBg = posRange.getBackgrounds();
    var newBg = existingBg.map(function(row) {
      return [shadeColor(row[0], -6)];
    });
    posRange.setBackgrounds(newBg);
  }

  // Bordură groasă ÎNTRE PERECHI (în stânga fiecărei coloane Sg., adică separă
  // de perechea anterioară), fără bordură între Sg. și Poz. din aceeași pereche
  for (var j = 0; j < maxArrows; j++) {
    var scoreColB = 2 + (j * 2);
    var leftBorderRange = sheet.getRange(headerRow, scoreColB, totalRow - headerRow + 1, 1);
    leftBorderRange.setBorder(null, true, null, null, null, null, '#888888', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  // Coloana Total serie — lățime mai mare + bordură groasă în stânga
  var totalCol = 2 + (maxArrows * 2);
  sheet.setColumnWidth(totalCol, 90);
  var totalColRange = sheet.getRange(headerRow, totalCol, totalRow - headerRow + 1, 1);
  totalColRange.setBorder(null, true, null, null, null, null, '#888888', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Bordură exterioară completă pentru tot tabelul
  var fullTable = sheet.getRange(headerRow, 1, totalRow - headerRow + 1, totalCol);
  fullTable.setBorder(true, true, true, true, false, false, '#666666', SpreadsheetApp.BorderStyle.SOLID);
}

// ── Helper: ajustează luminozitatea unei culori hex ──────────
function shadeColor(hex, percent) {
  if (!hex || hex === '#ffffff' && percent > 0) hex = '#ffffff';
  hex = (hex || '#ffffff').replace('#', '');
  if (hex.length !== 6) return '#' + hex;
  var r = parseInt(hex.substring(0,2), 16);
  var g = parseInt(hex.substring(2,4), 16);
  var b = parseInt(hex.substring(4,6), 16);
  r = Math.min(255, Math.max(0, r + percent));
  g = Math.min(255, Math.max(0, g + percent));
  b = Math.min(255, Math.max(0, b + percent));
  var toHex = function(n) { var s = n.toString(16); return s.length === 1 ? '0' + s : s; };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// ── Summary sheet all-time ────────────────────────────────
function updateSummarySheet(ss, newSession) {
  var sheet = ss.getSheetByName(SUMMARY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SUMMARY_SHEET, 0);
    writeSummaryHeaders(sheet);
  }
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
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);
  updateSummaryTotals(sheet);
  sheet.autoResizeColumns(1, 11);
}

function writeSummaryHeaders(sheet) {
  sheet.getRange(1, 1, 1, 11).merge()
       .setValue('ARCHERY SCORER — STATISTICI ALL-TIME')
       .setBackground('#1a1a2e').setFontColor('#e8c44a')
       .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 32);
  var hdr = ['Data','Tip','Arc','Distanta','Serii','Sageti','Total','X-uri','Medie/sg','Best End','Competitie'];
  sheet.getRange(2, 1, 1, hdr.length).setValues([hdr])
       .setBackground('#2e3452').setFontColor('#e8c44a').setFontWeight('bold');
  sheet.getRange(3, 1, 1, 11).setBackground('#0f1117').setFontColor('#7a84a8');
}

function updateSummaryTotals(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) {
    sheet.getRange(3, 1, 1, 11).setValues([['Nu sunt sesiuni înregistrate','','','','','','','','','','']]);
    return;
  }
  var data = sheet.getRange(4, 1, lastRow - 3, 11).getValues();
  var totalSess = data.length;
  var totalEnds = 0, totalArr = 0, totalPts = 0, totalXs = 0, bestEnd = 0;
  data.forEach(function(r) {
    totalEnds += r[4] || 0;
    totalArr  += r[5] || 0;
    totalPts  += r[6] || 0;
    totalXs   += r[7] || 0;
    if ((r[9]||0) > bestEnd) bestEnd = r[9];
  });
  var globalAvg = totalArr > 0 ? parseFloat((totalPts/totalArr).toFixed(2)) : 0;
  var sumRow = ['TOTAL (' + totalSess + ' sesiuni)','','','',totalEnds,totalArr,totalPts,totalXs,globalAvg,bestEnd,''];
  sheet.getRange(3, 1, 1, sumRow.length).setValues([sumRow])
       .setBackground('#e8c44a').setFontColor('#111').setFontWeight('bold');
}
