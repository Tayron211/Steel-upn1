const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('CONTROL DOCENTE.xlsx');

const report = {
  sheetNames: workbook.SheetNames,
  sheets: {}
};

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = data[0] || [];
  const sampleRows = data.slice(1, 4);
  const totalRows = data.length > 0 ? data.length - 1 : 0;

  report.sheets[sheetName] = {
    totalRows,
    headers,
    sampleRows
  };
});

fs.writeFileSync('excel_analysis.json', JSON.stringify(report, null, 2), 'utf-8');
console.log('Analysis written to excel_analysis.json');
console.log('Sheets found:', workbook.SheetNames);

