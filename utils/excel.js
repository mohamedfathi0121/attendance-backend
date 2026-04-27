const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../files/students.xlsx');

function readExcel() {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

function writeExcel(data) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, filePath);
}

function getTodayColumn() {
  return new Date().toISOString().split('T')[0];
}

module.exports = { readExcel, writeExcel, getTodayColumn };