# Curicula-VS v2.0

Aplikasi permainan kelas statis berbasis **Vite + TypeScript + MediaPipe Hand Landmarker** untuk materi **Hakikat, Fungsi, Prinsip, Komponen, dan Perkembangan Kurikulum**, dengan konteks pendidikan fisika.

## Format pertandingan

- Babak 1 — A1 vs B1: **10 Pilihan Ganda**
- Babak 2 — A2 vs B2: **10 Benar/Salah**
- Babak 3 — A3 vs B3: **5 Menjodohkan** (4 pasangan per soal)
- Babak 4 — A4 vs B4: **10 Pilihan Lebih dari 1** (4 opsi)
- Total: **35 soal**
- Durasi: **7 menit per babak**
- Tim A dan Tim B menerima urutan soal yang berbeda.

## Gesture

- Pilihan Ganda: **☝️ A, ✌️ B, 🤟 C, ✋ D**, lalu **✊ KUNCI**.
- Benar/Salah: **☝️ A = BENAR, ✌️ B = SALAH**, lalu **✊ KUNCI**.
- Menjodohkan: arahkan tangan, **pinch** kartu, geser ke pasangan, lepas, lalu **✊ KUNCI**.
- Pilihan lebih dari 1: **☝️ A, ✌️ B, 🤟 C, ✋ D** sebagai toggle. Gesture yang sama lagi membatalkan opsi, lalu **✊ KUNCI**.

## Pembahasan & kunci

Selama permainan, kunci tidak ditampilkan. Setelah seluruh pertandingan selesai, tombol **Pembahasan & Kunci** menampilkan untuk masing-masing tim:

- jawaban pemain;
- kunci jawaban;
- status benar/sempurna atau belum sempurna;
- poin yang diperoleh;
- pembahasan setiap soal;
- soal yang tidak sempat dijawab apabila waktu habis.

## Tampilan tanpa scroll saat bermain

Area permainan dikunci pada tinggi layar (`100dvh`) dan soal disusun agar stimulus, pertanyaan, opsi, serta kontrol gesture terlihat dalam satu layar. Scroll hanya digunakan pada halaman pembahasan setelah permainan selesai.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka alamat localhost yang diberikan Vite. Untuk kamera, gunakan browser modern melalui **HTTPS atau localhost**.

## Build & validasi

```bash
npm run check
npm run build
```

Bank soal berada di `src/data/questions.json`.

## Privasi

Video kamera diproses langsung di browser. Aplikasi tidak mengunggah video ke server.
