const path = require('path');
const { importExcelData } = require('../server/services/excelImporter');

const excelPath = path.join(__dirname, '..', 'CONTROL DOCENTE.xlsx');

try {
  const data = importExcelData(excelPath);
  process.stdout.write(JSON.stringify(data));
} catch (err) {
  process.stderr.write(err.message);
  process.exit(1);
}

