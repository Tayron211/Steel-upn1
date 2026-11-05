const XLSX = require('xlsx');

const workbook = XLSX.readFile('CONTROL DOCENTE.xlsx');

workbook.SheetNames.forEach(sheetName => {
  console.log('====================================================');
  console.log('SHEET:', sheetName);
  console.log('====================================================');
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  for (let i = 0; i < Math.min(6, data.length); i++) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]));
  }
  console.log('\n');
});

