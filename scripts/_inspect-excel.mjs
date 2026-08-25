// Vaqtinchalik yordamchi: istalgan Excel/CSV faylning ustunlari va birinchi
// qatorlarini ko'rsatadi — import skriptini yozishdan oldin sxemani aniqlash uchun.
//
// Ishga tushirish: node scripts/_inspect-excel.mjs "C:/path/to/fayl.xlsx"
import XLSX from "xlsx";

const file = process.argv[2];
if (!file) {
  console.error('Foydalanish: node scripts/_inspect-excel.mjs "<fayl yo\'li>"');
  process.exit(1);
}

const wb = XLSX.readFile(file);
console.log("Fayl:", file);
console.log("Varaqlar:", wb.SheetNames.join(", "));

for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
  const filled = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  console.log(`\n=== Varaq "${name}" — ${rows.length} qator (${filled.length} to'ldirilgan) ===`);
  rows.slice(0, 15).forEach((r, i) => {
    const cells = r.map((c) => String(c).trim());
    while (cells.length && cells[cells.length - 1] === "") cells.pop();
    if (cells.length) console.log(`${String(i).padStart(3)}: ${cells.join(" | ")}`);
  });
  if (rows.length > 15) console.log(`... yana ${rows.length - 15} qator`);
}
