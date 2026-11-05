const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('CONTROL DOCENTE.xlsx');

const fullReport = {};

function excelDateToString(serial) {
  if (typeof serial !== 'number') return serial;
  if (serial < 1) {
    // It's a time fraction
    const totalMinutes = Math.round(serial * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  // Date serial
  const utc_days = Math.floor(serial - 25569);
  const date = new Date(utc_days * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

wb.SheetNames.forEach(sheetName => {
  const sheet = wb.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find the header row (first non-empty row or first row with >= 2 strings)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.filter(c => typeof c === 'string' && c.trim().length > 0).length >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (rawData[headerRowIdx] || []).map((h, i) => (h ? String(h).trim() : `COL_${i}`));
  const rows = rawData.slice(headerRowIdx + 1);

  // Column stats
  const colStats = {};
  headers.forEach((h, colIdx) => {
    const values = rows.map(r => r ? r[colIdx] : undefined).filter(v => v !== undefined && v !== null && v !== '');
    const sampleDistinct = Array.from(new Set(values.map(v => typeof v === 'number' ? excelDateToString(v) : String(v).trim()))).slice(0, 15);
    colStats[h] = {
      nonEmptyCount: values.length,
      sampleValues: sampleDistinct,
      totalDistinct: new Set(values).size
    };
  });

  fullReport[sheetName] = {
    headerRowIdx,
    totalRows: rows.length,
    headers,
    colStats,
    sampleRows: rows.slice(0, 3).map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        const val = r ? r[idx] : undefined;
        obj[h] = typeof val === 'number' ? excelDateToString(val) : val;
      });
      return obj;
    })
  };
});

fs.writeFileSync('detailed_schema.json', JSON.stringify(fullReport, null, 2), 'utf-8');
console.log('Detailed schema generated successfully.');

