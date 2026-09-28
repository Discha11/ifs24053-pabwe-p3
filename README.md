# ifs24053-pabwe-p3 — Kotak Harian

Studi kasus Praktikum PABWE 3 — **Praktik JavaScript**.
Aplikasi satu halaman dengan 3 tab, masing-masing punya logika dan `localStorage` sendiri.

- Nama: Discha Uli Virghylia Hutasoit
- NIM: 11S24053

## Fitur per tab

| Tab | Fitur | Key localStorage |
|---  |---    |---               |
| Pengeluaran | CRUD transaksi, ringkasan saldo, cari/filter/sort | `kotak-harian-expenses` |
| Bookmark | CRUD tautan, validasi URL, cari/sort, buka tab baru | `kotak-harian-bookmarks` |
| Kuis | 6 soal pilihan ganda, skor, high score | `kotak-harian-quiz-highscore` |
| (semua tab) | Tab terakhir yang dibuka diingat | `kotak-harian-active-tab` |

## Struktur

```
├── index.html          # markup 3 tab + 4 modal
├── assets/
│   └── script.js       # seluruh logika JS, dikelompokkan per fitur
└── README.md
```

## Cara menjalankan

Buka `index.html` di browser (perlu koneksi internet untuk memuat Tailwind CDN,
Google Fonts, dan Tabler Icons). Tidak butuh server atau build step.

## Catatan implementasi

- Semua elemen DOM diambil lewat helper `$()`/`$all()` yang melempar error jika
  selector tidak ditemukan — memudahkan debug saat markup berubah.
- Ubah dan hapus data selalu lewat modal (bukan `prompt()`/`confirm()` browser).
- Tidak ada logika di atribut inline (`onclick="..."`) — semua event listener
  didaftarkan dari `assets/script.js`.
