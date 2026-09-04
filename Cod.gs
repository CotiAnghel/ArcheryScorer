// Archery Scorer - Google Apps Script
// Deploy -> New deployment -> Web App -> Execute as: Me -> Anyone -> Deploy
// De ce nu rateaza niciodata arcasul cand joaca poker? Pentru ca stie mereu sa tina X-ul ascuns.

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
  if (e.parameter && e.parameter.action === 'info') {
    return handleInfo();
  }
  if (e.parameter && e.parameter.action === 'refreshChart') {
    return handleRefreshChart();
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Archery Scorer Script activ' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRefreshChart() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SUMMARY_SHEET);
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Foaia ' + SUMMARY_SHEET + ' nu exista' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  buildSummaryChart(sheet);
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Grafic regenerat' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleInfo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets().map(function(sheet) {
    return {
      name: sheet.getName(),
      rows: sheet.getLastRow(),
      cols: sheet.getLastColumn(),
      charts: sheet.getCharts().length
    };
  });
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      sheetCount: sheets.length,
      sheets: sheets
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

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

function handleDelete(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(payload.sheetName);
  if (sheet) ss.deleteSheet(sheet);
  var summary = ss.getSheetByName(SUMMARY_SHEET);
  if (summary && payload.sessionDate) {
    var tz = Session.getScriptTimeZone();
    var date = new Date(payload.sessionDate);
    var dateStr = Utilities.formatDate(date, tz, 'dd-MM-yyyy HH:mm');
    var lastRow = summary.getLastRow();
    if (lastRow >= 4) {
      var data = summary.getRange(4, 1, lastRow - 3, 11).getValues();
      for (var i = data.length - 1; i >= 0; i--) {
        var cell = data[i][0];
        var rowDateStr = cell instanceof Date ? Utilities.formatDate(cell, tz, 'dd-MM-yyyy HH:mm') : String(cell);
        if (rowDateStr === dateStr) {
          summary.deleteRow(i + 4);
          break;
        }
      }
    }
    updateSummaryTotals(summary);
    buildSummaryChart(summary);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', deleted: payload.sheetName }))
    .setMimeType(ContentService.MimeType.JSON);
}

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

function writeSessionToSheet(sheet, data) {
  var ends = data.ends || [];
  var allArrows = [];
  ends.forEach(function(end) {
    (end.arrows || []).forEach(function(a) { allArrows.push(a); });
  });
  var totalScore = data.totalScore || 0;
  var totalXs = data.totalXs || 0;
  var totalArr = data.totalArrows || allArrows.length;
  var avg = totalArr > 0 ? parseFloat((totalScore / totalArr).toFixed(2)) : 0;
  var best = 0;
  ends.forEach(function(end) { if ((end.total || 0) > best) best = end.total; });

  var info = [
    ['Tip sesiune', data.type === 'training' ? 'Antrenament' : 'Concurs'],
    ['Arc', (data.bow && data.bow.name) ? data.bow.name : ''],
    ['Putere (lbs)', (data.bow && data.bow.poundage) ? data.bow.poundage : ''],
    ['Tip arc', (data.bow && data.bow.type) ? data.bow.type : ''],
    ['Data', Utilities.formatDate(new Date(data.date), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm')],
    ['Distanta (m)', (data.config && data.config.distance) ? data.config.distance : ''],
    ['Tip tinta', (data.config && data.config.target) ? data.config.target : '']
  ];
  if (data.type === 'competition' && data.competition) {
    info.push(['Competitie', data.competition.name || '']);
  }

  var row = 1;
  info.forEach(function(r) {
    var rng = sheet.getRange(row, 1, 1, 2);
    rng.setValues([r]);
    rng.setBackground('#ffffff').setFontColor('#1a1a2e');
    row++;
  });
  row++;

  var stats = [
    ['-- STATISTICI SESIUNE --', ''],
    ['Total puncte', totalScore],
    ['X-uri', totalXs],
    ['Sageti trase', totalArr],
    ['Serii', ends.length],
    ['Medie/sageata', avg],
    ['Cel mai bun end', best]
  ];
  stats.forEach(function(r) {
    var rng = sheet.getRange(row, 1, 1, 2);
    rng.setValues([r]);
    if (r[0].indexOf('--') !== -1) {
      rng.setBackground('#1a1a2e').setFontColor('#e8c44a').setFontWeight('bold');
    } else {
      rng.setBackground('#f8f9fa').setFontColor('#1a1a2e');
    }
    row++;
  });
  row++;

  var maxArrows = 0;
  ends.forEach(function(end) {
    var cnt = (end.arrows || []).length;
    if (cnt > maxArrows) maxArrows = cnt;
  });
  if (maxArrows === 0) maxArrows = 6;

  var tableStartRow = row;
  var tableHdr = ['Seria'];
  for (var h = 1; h <= maxArrows; h++) {
    tableHdr.push('Sg.' + h);
    tableHdr.push('Poz.' + h);
  }
  tableHdr.push('Total serie');

  var hdrRange = sheet.getRange(row, 1, 1, tableHdr.length);
  hdrRange.setValues([tableHdr]);
  hdrRange.setBackground('#2e3452').setFontColor('#e8c44a').setFontWeight('bold');
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
      rowRange.setBackground('#e8f0fe').setFontColor('#1a1a2e');
    } else {
      rowRange.setBackground('#ffffff').setFontColor('#1a1a2e');
    }
    rowRange.setHorizontalAlignment('center');
    row++;
  });
  var lastDataRow = row - 1;

  var totRow = ['TOTAL'];
  for (var t = 0; t < maxArrows * 2; t++) totRow.push('');
  totRow.push(totalScore);
  var totRange = sheet.getRange(row, 1, 1, totRow.length);
  totRange.setValues([totRow]);
  totRange.setBackground('#e8c44a').setFontColor('#111').setFontWeight('bold');
  totRange.setHorizontalAlignment('center');

  formatArrowTable(sheet, tableStartRow, firstDataRow, lastDataRow, maxArrows);
  row++;

  // Centraj
  var centrajRow = row + 1;
  writeCentrajSection(sheet, centrajRow, ends);
}

var SCORE_RADIUS = {
  'X': 0, '10': 0.5, '9': 1.5, '8': 2.5, '7': 3.5,
  '6': 4.5, '5': 5.5, '4': 6.5, '3': 7.5, '2': 8.5, '1': 9.5, 'M': 10.5
};

function arrowToXY(score, position) {
  var r = SCORE_RADIUS[String(score)];
  if (r === undefined) r = 5.0;
  if (r === 0 || !position) return { x: 0, y: 0 };
  var angleDeg = (parseInt(position) / 12.0) * 360.0;
  var angleRad = angleDeg * Math.PI / 180;
  return { x: r * Math.sin(angleRad), y: -r * Math.cos(angleRad) };
}

function groupCenter(arrows) {
  var exact = arrows.filter(function(a) { return a.score !== 'M' && a.xMm !== undefined; });
  var estimated = arrows.filter(function(a) { return a.score !== 'M' && a.xMm === undefined && a.position; });
  var hasExact = exact.length > 0;
  var coords, unit;
  if (hasExact) {
    coords = exact.map(function(a) { return { x: a.xMm, y: a.yMm }; });
    unit = 'mm';
  } else if (estimated.length > 0) {
    coords = estimated.map(function(a) { return arrowToXY(a.score, a.position); });
    unit = 'u';
  } else { return null; }
  var cx = coords.reduce(function(s, c) { return s + c.x; }, 0) / coords.length;
  var cy = coords.reduce(function(s, c) { return s + c.y; }, 0) / coords.length;
  var spread = Math.sqrt(coords.reduce(function(s, c) {
    return s + (c.x - cx) * (c.x - cx) + (c.y - cy) * (c.y - cy);
  }, 0) / coords.length);
  var dist = Math.sqrt(cx * cx + cy * cy);
  var angleDeg = ((Math.atan2(cx, -cy) * 180 / Math.PI) + 360) % 360;
  var hour = ((angleDeg / 360 * 12) % 12) || 12;
  var dirLabels = {
    12: 'sus', 1: 'sus-dreapta', 2: 'sus-dreapta', 3: 'dreapta',
    4: 'jos-dreapta', 5: 'jos-dreapta', 6: 'jos', 7: 'jos-stanga',
    8: 'jos-stanga', 9: 'stanga', 10: 'sus-stanga', 11: 'sus-stanga'
  };
  var dir = dist < 0.5 ? 'centrat' : (dirLabels[Math.round(hour)] || '--') + ' (' + Math.round(hour) + 'h)';
  return {
    cx: Math.round(cx * 100) / 100,
    cy: Math.round(cy * 100) / 100,
    spread: Math.round(spread * 100) / 100,
    dist: Math.round(dist * 100) / 100,
    dir: dir, count: coords.length, unit: unit, hasExact: hasExact
  };
}

function writeCentrajSection(sheet, startRow, ends) {
  var row = startRow;

  var hdrCentraj = sheet.getRange(row, 1, 1, 6);
  hdrCentraj.merge().setValue('CENTRAJ GRUP');
  hdrCentraj.setBackground('#1a1a2e').setFontColor('#e8c44a').setFontWeight('bold');
  row++;

  var colHdr = ['Seria', 'Sageti', 'X (dr/st)', 'Y (jos/sus)', 'Distanta', 'Directie eroare'];
  sheet.getRange(row, 1, 1, colHdr.length).setValues([colHdr])
       .setBackground('#2e3452').setFontColor('#e8c44a').setFontWeight('bold')
       .setHorizontalAlignment('center');
  row++;

  var allArrows = [];
  ends.forEach(function(end, idx) {
    var arrows = end.arrows || [];
    allArrows = allArrows.concat(arrows);
    var c = groupCenter(arrows);
    if (!c) return;
    var xLabel = c.cx > 0 ? '+' + c.cx + ' (dr)' : c.cx < 0 ? c.cx + ' (st)' : '0';
    var yLabel = c.cy > 0 ? '+' + c.cy + ' (jos)' : c.cy < 0 ? c.cy + ' (sus)' : '0';
    var r = [end.endNumber || idx + 1, c.count, xLabel, yLabel, c.dist + ' ' + c.unit, c.dir];
    var dataRange = sheet.getRange(row, 1, 1, r.length);
    dataRange.setValues([r]).setHorizontalAlignment('center');
    if (idx % 2 === 0) {
      dataRange.setBackground('#e8f0fe').setFontColor('#1a1a2e');
    } else {
      dataRange.setBackground('#ffffff').setFontColor('#1a1a2e');
    }
    row++;
  });

  var sc = groupCenter(allArrows);
  if (sc) {
    var xLabelS = sc.cx > 0 ? '+' + sc.cx + ' (dr)' : sc.cx < 0 ? sc.cx + ' (st)' : '0';
    var yLabelS = sc.cy > 0 ? '+' + sc.cy + ' (jos)' : sc.cy < 0 ? sc.cy + ' (sus)' : '0';
    var totRow2 = ['SESIUNE', sc.count, xLabelS, yLabelS, sc.dist + ' ' + sc.unit, sc.dir];
    sheet.getRange(row, 1, 1, totRow2.length).setValues([totRow2])
         .setBackground('#e8c44a').setFontColor('#111').setFontWeight('bold')
         .setHorizontalAlignment('center');
    row++;

    // Grafic scatter
    drawCentrajChart(sheet, row + 1, ends, sc);
  }
  sheet.setColumnWidth(6, 140);
}

var CENTRAJ_STAGING_COL = 20; // T

function drawCentrajChart(sheet, startRow, ends, sessionCenter) {
  var points = [];
  ends.forEach(function(end, idx) {
    var c = groupCenter(end.arrows || []);
    if (!c) return;
    var num = end.endNumber || idx + 1;
    points.push(['S' + num, c.cx, c.cy, num, 6]);
  });
  if (!sessionCenter) return;
  points.push(['Sesiune', sessionCenter.cx, sessionCenter.cy, 0, 16]);
  if (points.length === 0) return;

  // Tabel unic si contiguu: ID, X, Y, Grup, Marime (ordine ceruta de
  // Google Charts pentru bubble chart: col 3 = grup/culoare, col 4 = marime).
  var baseCol = CENTRAJ_STAGING_COL;
  var hdr = ['ID', 'X', 'Y', 'Grup', 'Marime'];
  sheet.getRange(startRow, baseCol, points.length + 1, hdr.length).clearContent();
  sheet.getRange(startRow, baseCol, 1, hdr.length).setValues([hdr]);
  sheet.getRange(startRow + 1, baseCol, points.length, hdr.length).setValues(points);
  sheet.hideColumns(baseCol, hdr.length);

  var dataRange = sheet.getRange(startRow, baseCol, points.length + 1, hdr.length);
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.BUBBLE)
    .addRange(dataRange)
    .setNumHeaders(1)
    .setOption('title', 'Centraj grupaj — per serie & sesiune')
    .setOption('hAxis', { title: 'X (stanga/dreapta)', minValue: -10, maxValue: 10, gridlines: { count: 9 } })
    .setOption('vAxis', { title: 'Y (sus/jos)', minValue: -10, maxValue: 10, gridlines: { count: 9 } })
    .setOption('legend', { position: 'right' })
    .setOption('sizeAxis', { minValue: 6, maxValue: 16, minSize: 6, maxSize: 16 })
    .setOption('bubble', { opacity: 0.85 })
    .setOption('width', 600)
    .setOption('height', 600)
    .setPosition(startRow, baseCol - 12, 0, 0)
    .build();

  sheet.insertChart(chart);
}

function formatArrowTable(sheet, headerRow, firstDataRow, lastDataRow, maxArrows) {
  var totalRow = lastDataRow + 1;
  sheet.setColumnWidth(1, 90);

  for (var i = 0; i < maxArrows; i++) {
    var scoreCol = 2 + (i * 2);
    var posCol = scoreCol + 1;
    sheet.setColumnWidth(scoreCol, 55);
    sheet.setColumnWidth(posCol, 55);

    var posRange = sheet.getRange(firstDataRow, posCol, lastDataRow - firstDataRow + 1, 1);
    var existingBg = posRange.getBackgrounds();
    var newBg = existingBg.map(function(r) {
      return [shadeColor(r[0], -6)];
    });
    posRange.setBackgrounds(newBg);
  }

  for (var j = 0; j < maxArrows; j++) {
    var scoreColB = 2 + (j * 2);
    sheet.getRange(headerRow, scoreColB, totalRow - headerRow + 1, 1)
         .setBorder(null, true, null, null, null, null, '#888888', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  var totalCol = 2 + (maxArrows * 2);
  sheet.setColumnWidth(totalCol, 90);
  sheet.getRange(headerRow, totalCol, totalRow - headerRow + 1, 1)
       .setBorder(null, true, null, null, null, null, '#888888', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  sheet.getRange(headerRow, 1, totalRow - headerRow + 1, totalCol)
       .setBorder(true, true, true, true, false, false, '#666666', SpreadsheetApp.BorderStyle.SOLID);
}

function shadeColor(hex, percent) {
  hex = (hex || '#ffffff').replace('#', '');
  if (hex.length !== 6) return '#' + hex;
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  r = Math.min(255, Math.max(0, r + percent));
  g = Math.min(255, Math.max(0, g + percent));
  b = Math.min(255, Math.max(0, b + percent));
  var toHex = function(n) { var s = n.toString(16); return s.length === 1 ? '0' + s : s; };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function updateSummarySheet(ss, newSession) {
  var sheet = ss.getSheetByName(SUMMARY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SUMMARY_SHEET, 0);
    writeSummaryHeaders(sheet);
  }
  var ends = newSession.ends || [];
  var arrows = [];
  ends.forEach(function(e) { (e.arrows || []).forEach(function(a) { arrows.push(a); }); });
  var total = newSession.totalScore || 0;
  var xs = newSession.totalXs || 0;
  var cnt = newSession.totalArrows || arrows.length;
  var avg = cnt > 0 ? parseFloat((total / cnt).toFixed(2)) : 0;
  var best = 0;
  ends.forEach(function(e) { if ((e.total || 0) > best) best = e.total; });
  var date = Utilities.formatDate(new Date(newSession.date), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm');
  var bow = (newSession.bow && newSession.bow.name) ? newSession.bow.name : '';
  var dist = (newSession.config && newSession.config.distance) ? newSession.config.distance + 'm' : '';
  var type = newSession.type === 'training' ? 'Antrenament' : 'Concurs';
  var comp = (newSession.competition && newSession.competition.name) ? newSession.competition.name : '';
  var tipTinta = (newSession.config && newSession.config.target) ? newSession.config.target : '';
  var newRow = [date, type, bow, dist, ends.length, cnt, total, xs, avg, best, comp, tipTinta];
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);
  updateSummaryTotals(sheet);
  sheet.autoResizeColumns(1, 12);
  buildSummaryChart(sheet);
}

// ── Grafic Scor total & Medie/sageata, cate unul per tip de antrenament
// (distanta + tip tinta) — punctajul maxim posibil difera intre tipuri,
// deci nu le amestecam pe acelasi grafic (la fel ca in aplicatie).
var CHART_TITLE = 'Scor total & Medie/sageata';
var CHART_STAGING_COL = 14; // N
var CHART_STAGING_GROUP_WIDTH = 4; // 3 coloane de date + 1 gol intre grupuri
var CHART_MAX_GROUPS = 15; // cat de larg curatam zona de staging

function buildSummaryChart(sheet) {
  var lastRow = sheet.getLastRow();

  // Curata zona de staging si toate graficele vechi generate de script
  sheet.getRange(3, CHART_STAGING_COL, Math.max(sheet.getMaxRows() - 2, 1),
                  CHART_STAGING_GROUP_WIDTH * CHART_MAX_GROUPS).clearContent();
  sheet.getCharts().forEach(function(c) {
    var t = c.getOptions().get('title') || '';
    if (t.indexOf(CHART_TITLE) === 0) sheet.removeChart(c);
  });

  if (lastRow < 4) return;

  var data = sheet.getRange(4, 1, lastRow - 3, 12).getValues();
  // Grupeaza pe distanta + tip tinta (col D=3, col L=11)
  var groups = {}; // key -> { label, bows:Set, rows:[[data,total,medie]] }
  data.forEach(function(r) {
    if (r[1] !== 'Antrenament' || !r[0]) return;
    var dist = r[3] || '';
    var tinta = r[11] || '';
    var key = dist + '|' + tinta;
    if (!groups[key]) {
      var tintaLabel = tinta ? String(tinta).replace(/_/g, ' ') : 'tip țintă necunoscut';
      groups[key] = { label: dist + ' · ' + tintaLabel, bows: {}, rows: [] };
    }
    if (r[2]) groups[key].bows[r[2]] = true;
    groups[key].rows.push([r[0], r[6], r[8]]); // Data, Total, Medie/sg
  });

  var groupKeys = Object.keys(groups);
  groupKeys.forEach(function(key, gi) {
    var g = groups[key];
    g.rows.sort(function(a, b) { return new Date(a[0]) - new Date(b[0]); });
    var col = CHART_STAGING_COL + gi * CHART_STAGING_GROUP_WIDTH;

    sheet.getRange(3, col, 1, 3).setValues([['Data', 'Scor total', 'Medie/sageata']]);
    sheet.getRange(4, col, g.rows.length, 3).setValues(g.rows);

    var bowNames = Object.keys(g.bows);
    var title = CHART_TITLE + ' — ' + g.label +
      (bowNames.length > 1 ? ' (Arcuri: ' + bowNames.join(', ') + ')'
        : bowNames.length === 1 ? ' (Arc: ' + bowNames[0] + ')' : '');

    var dataRange = sheet.getRange(3, col, g.rows.length + 1, 3);
    var chart = sheet.newChart()
      .asComboChart()
      .addRange(dataRange)
      .setNumHeaders(1)
      .setOption('title', title)
      .setOption('series', {
        0: { type: 'line', targetAxisIndex: 0, color: '#e8c44a' },
        1: { type: 'line', targetAxisIndex: 1, color: '#3b82f6' }
      })
      .setOption('vAxes', {
        0: { title: 'Scor total' },
        1: { title: 'Medie/sageata', minValue: 0, maxValue: 10 }
      })
      .setOption('hAxis', { title: 'Data' })
      .setOption('width', 700)
      .setOption('height', 350)
      .setPosition(15 + gi * 20, 1, 0, 0)
      .build();
    sheet.insertChart(chart);
  });

  sheet.hideColumns(CHART_STAGING_COL, CHART_STAGING_GROUP_WIDTH * Math.max(groupKeys.length, 1));
}

function writeSummaryHeaders(sheet) {
  sheet.getRange(1, 1, 1, 12).merge()
       .setValue('ARCHERY SCORER - STATISTICI ALL-TIME')
       .setBackground('#1a1a2e').setFontColor('#e8c44a')
       .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 32);
  var hdr = ['Data', 'Tip', 'Arc', 'Distanta', 'Serii', 'Sageti', 'Total', 'X-uri', 'Medie/sg', 'Best End', 'Competitie', 'Tip tinta'];
  sheet.getRange(2, 1, 1, hdr.length).setValues([hdr])
       .setBackground('#2e3452').setFontColor('#e8c44a').setFontWeight('bold');
  sheet.getRange(3, 1, 1, 12).setBackground('#0f1117').setFontColor('#7a84a8');
}

function updateSummaryTotals(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) {
    sheet.getRange(3, 1, 1, 12).setValues([['Nu sunt sesiuni inregistrate', '', '', '', '', '', '', '', '', '', '', '']]);
    return;
  }
  var data = sheet.getRange(4, 1, lastRow - 3, 12).getValues();
  var totalSess = data.length;
  var totalEnds = 0, totalArr = 0, totalPts = 0, totalXs = 0, bestEnd = 0;
  data.forEach(function(r) {
    totalEnds += r[4] || 0;
    totalArr += r[5] || 0;
    totalPts += r[6] || 0;
    totalXs += r[7] || 0;
    if ((r[9] || 0) > bestEnd) bestEnd = r[9];
  });
  var globalAvg = totalArr > 0 ? parseFloat((totalPts / totalArr).toFixed(2)) : 0;
  var sumRow = ['TOTAL (' + totalSess + ' sesiuni)', '', '', '', totalEnds, totalArr, totalPts, totalXs, globalAvg, bestEnd, ''];
  sheet.getRange(3, 1, 1, sumRow.length).setValues([sumRow])
       .setBackground('#e8c44a').setFontColor('#111').setFontWeight('bold');
}
