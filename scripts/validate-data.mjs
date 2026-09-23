import fs from "node:fs";
const file = new URL("../src/data/questions.json", import.meta.url);
const questions = JSON.parse(fs.readFileSync(file, "utf8"));
const expected = { single: 10, boolean: 10, sequence: 5, multi: 10 };
const counts = { single: 0, boolean: 0, sequence: 0, multi: 0 };
const ids = new Set();
const errors = [];
for (const q of questions) {
  if (!q.id || ids.has(q.id)) errors.push(`ID invalid/duplikat: ${q.id}`);
  ids.add(q.id);
  if (!(q.type in counts)) errors.push(`${q.id}: type tidak dikenal`); else counts[q.type]++;
  if (!q.stimulus || !q.prompt || !q.explanation) errors.push(`${q.id}: stimulus/prompt/explanation kosong`);
  if (q.type === "single") {
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${q.id}: PG harus 4 opsi`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) errors.push(`${q.id}: kunci PG invalid`);
  }
  if (q.type === "boolean" && typeof q.correct !== "boolean") errors.push(`${q.id}: kunci B/S invalid`);
  if (q.type === "sequence") {
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${q.id}: urutan harus 4 kartu`);
    if (!Array.isArray(q.correctOrder) || q.correctOrder.length !== 4) errors.push(`${q.id}: correctOrder harus 4 posisi`);
    const order = new Set(q.correctOrder ?? []);
    if (order.size !== 4 || [...order].some(i => !Number.isInteger(i) || i < 0 || i > 3)) errors.push(`${q.id}: correctOrder invalid`);
  }
  if (q.type === "multi") {
    if (!Array.isArray(q.options) || q.options.length < 4) errors.push(`${q.id}: multi opsi terlalu sedikit`);
    if (!Array.isArray(q.correct) || q.correct.length < 2) errors.push(`${q.id}: multi harus punya >1 jawaban benar`);
  }
}
for (const [type, count] of Object.entries(expected)) if (counts[type] !== count) errors.push(`${type}: ${counts[type]} (harus ${count})`);
if (questions.length !== 35) errors.push(`Total ${questions.length} (harus 35)`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("[OK] Bank soal valid:", counts, "total=35");
