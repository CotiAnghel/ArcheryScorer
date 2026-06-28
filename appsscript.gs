// ── Archery Scorer — Google Apps Script ──────────────────
// Lipește acest cod în Extensions → Apps Script din Google Sheets
// Apoi: Deploy → New deployment → Web App → Anyone → Deploy

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Construiește numele foii
    const date = new Date(data.date);
    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MM-yyyy');
    const type = data.type === 'training' ? 'Ant' : 'Cnc';
    const bowName = (data.bow && data.bow.name) ? data.bow.name.substring(0, 15) : 'Arc';
    const dist = data.config && data.config.distance ? data.config.distance + 'm' : '';
    let sheetName = `${type}_${bowName}_${dist}_${dateStr}`.replace(/[\/\\?\*\[\]:]/g, '').substring(0, 100);

    // Dacă există deja foaia cu același nume, adaugă suffix
    let suffix = 0;
    let finalName = sheetName;
    while (ss.getSheetByName(finalName)) {
      suffix++;
      finalName = sheetName + `_${suffix}`;
    }

    // Creează foaia nouă
    const sheet = ss.insertSheet(finalName);

    // Header info
    const headers = [
      ['Tip sesiune', data.type === 'training' ? 'Antrenament' : 'Concurs'],
      ['Arc', (data.bow && data.bow.name) ? data.bow.name : ''],
      ['Putere (lbs)', (data.bow && data.bow.poundage) ? data.bow.poundage : ''],
      ['Tip arc', (data.bow && data.bow.type) ? data.bow.type : ''],
      ['Data', Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm')],
      ['Distanță (m)', (data.config && data.config.distance) ? data.config.distance : ''],
      ['Tip țintă', (data.config && data.config.target) ? data.config.target : ''],
      data.type === 'competition' ? ['Concurs', data.competition ? data.competition.name : ''] : ['', ''],
      [],
    ];

    // Adaugă rândurile de header
    headers.forEach((row, i) => {
      if (row.length > 0) {
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      }
    });

    // Rând titlu tabel
    const startRow = headers.length + 1;
    const tableHeader = ['Seria', 'Sg.1', 'Pos.1', 'Sg.2', 'Pos.2', 'Sg.3', 'Pos.3', 'Sg.4', 'Pos.4', 'Sg.5', 'Pos.5', 'Sg.6', 'Pos.6', 'Total serie'];
    sheet.getRange(startRow, 1, 1, tableHeader.length).setValues([tableHeader]);

    // Stilizare header tabel
    const headerRange = sheet.getRange(startRow, 1, 1, tableHeader.length);
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#e8c44a');
    headerRange.setFontWeight('bold');

    // Date serii
    const ends = data.ends || [];
    ends.forEach((end, idx) => {
      const row = [end.endNumber];
      for (let i = 0; i < 6; i++) {
        const arrow = end.arrows && end.arrows[i];
        row.push(arrow ? arrow.score : '');
        row.push(arrow && arrow.position ? arrow.position + 'h' : '');
      }
      row.push(end.total || 0);

      const rowNum = startRow + 1 + idx;
      sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);

      // Colorare alternată rânduri
      if (idx % 2 === 0) {
        sheet.getRange(rowNum, 1, 1, row.length).setBackground('#1e2338');
      }
    });

    // Rând totale
    const totalRow = startRow + 1 + ends.length + 1;
    const totals = [
      ['TOTAL GENERAL', '', '', '', '', '', '', '', '', '', '', '', '', data.totalScore || 0],
      ['X-uri', data.totalXs || 0],
      ['Săgeți trase', data.totalArrows || 0],
      ['Medie / săgeată', data.avgPerArrow || 0],
    ];
    totals.forEach((row, i) => {
      sheet.getRange(totalRow + i, 1, 1, row.length).setValues([row]);
    });

    // Stilizare rând total
    const totalRange = sheet.getRange(totalRow, 1, 1, 14);
    totalRange.setBackground('#e8c44a');
    totalRange.setFontColor('#111111');
    totalRange.setFontWeight('bold');

    // Lățime coloane auto
    sheet.autoResizeColumns(1, 14);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', sheet: finalName }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test GET pentru a verifica că scriptul funcționează
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Archery Scorer Script activ' }))
    .setMimeType(ContentService.MimeType.JSON);
}
