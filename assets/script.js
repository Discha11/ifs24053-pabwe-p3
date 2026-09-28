/**
 * Kotak Harian — Praktikum 3 (Studi Kasus)
 * Tiga fitur dalam satu halaman, dipisah lewat tab:
 *   1. Catatan Pengeluaran Harian (Expense Tracker)
 *   2. Bookmark / Link Manager
 *   3. Kuis Interaktif (Quiz App)
 * Setiap fitur punya key localStorage sendiri agar data tidak saling menimpa.
 */

/* ========================================================
   UTILITAS
   ======================================================== */

/** Ambil satu elemen; lempar error jika tidak ditemukan (memudahkan debug) */
function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Elemen tidak ditemukan: ${selector}`);
  return el;
}

function $all(selector) {
  return document.querySelectorAll(selector);
}

/** Format angka jadi Rupiah, mis. 15000 -> "Rp15.000" */
function formatRupiah(n) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

/** ID unik sederhana tanpa perlu library eksternal */
function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random());
}

/* ========================================================
   TAB SWITCHER (berlaku untuk 3 tab utama)
   ======================================================== */

const ACTIVE_TAB_KEY = "kotak-harian-active-tab";
const tabButtons = $all(".tab-btn");
const tabPanels = {
  expense: $("#panel-expense"),
  bookmark: $("#panel-bookmark"),
  quiz: $("#panel-quiz"),
};

/** Pindah tab aktif: sembunyikan panel lain, highlight tombol, ingat pilihan di localStorage */
function switchTab(name) {
  if (!tabPanels[name]) name = "expense";

  Object.entries(tabPanels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== name);
  });

  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle("bg-indigo-600", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("shadow", active);
    btn.classList.toggle("text-slate-600", !active);
    btn.classList.toggle("hover:bg-slate-100", !active);
    btn.setAttribute("aria-selected", String(active));
  });

  localStorage.setItem(ACTIVE_TAB_KEY, name);
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Urutan prioritas tab awal: parameter URL (?tab=quiz) > tab terakhir di localStorage > default
const tabFromUrl = new URLSearchParams(window.location.search).get("tab");
switchTab(tabFromUrl || localStorage.getItem(ACTIVE_TAB_KEY) || "expense");

/* ========================================================
   MODAL — dipakai bersama oleh Expense & Bookmark
   ======================================================== */

function openModal(modal) {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

// Tutup modal lewat tombol [data-close-modal], klik backdrop, atau tombol Escape
$all("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal($(`#${btn.dataset.closeModal}`)));
});
$all(".modal-backdrop").forEach((bd) => {
  bd.addEventListener("click", () => closeModal(bd.closest(".modal")));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  $all(".modal").forEach((m) => {
    if (!m.classList.contains("hidden")) closeModal(m);
  });
});

/* ========================================================
   1) EXPENSE TRACKER — Catatan Pengeluaran Harian
   ======================================================== */

const EXPENSE_KEY = "kotak-harian-expenses";
const EXPENSE_CATEGORIES = ["Makanan", "Transportasi", "Belanja", "Hiburan", "Tagihan", "Lainnya"];

let expenses = loadExpenses();
let editingExpenseId = null;
let deletingExpenseId = null;

const expenseForm = $("#expense-form");
const expenseTitle = $("#expense-title");
const expenseCategory = $("#expense-category");
const expenseAmount = $("#expense-amount");
const expenseType = $("#expense-type");
const expenseDate = $("#expense-date");

const expenseSearch = $("#expense-search");
const expenseFilterType = $("#expense-filter-type");
const expenseFilterCategory = $("#expense-filter-category");
const expenseSort = $("#expense-sort");
const expenseList = $("#expense-list");
const expenseEmpty = $("#expense-empty");

const sumIncomeEl = $("#expense-total-income");
const sumExpenseEl = $("#expense-total-expense");
const sumBalanceEl = $("#expense-balance");

const modalExpenseEdit = $("#modal-expense-edit");
const expenseEditForm = $("#expense-edit-form");
const editExpenseTitle = $("#edit-expense-title");
const editExpenseCategory = $("#edit-expense-category");
const editExpenseAmount = $("#edit-expense-amount");
const editExpenseType = $("#edit-expense-type");
const editExpenseDate = $("#edit-expense-date");

const modalExpenseDelete = $("#modal-expense-delete");
const expenseDeleteTitle = $("#expense-delete-title");
const expenseDeleteConfirm = $("#expense-delete-confirm");

function loadExpenses() {
  try {
    const raw = localStorage.getItem(EXPENSE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
}

/** Isi ulang dropdown kategori pada form tambah & filter dari EXPENSE_CATEGORIES */
function populateExpenseCategories() {
  const optionsHtml = EXPENSE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  expenseCategory.innerHTML = optionsHtml;
  editExpenseCategory.innerHTML = optionsHtml;
  expenseFilterCategory.innerHTML = `<option value="">Semua kategori</option>${optionsHtml}`;
}

/** Hitung ringkasan total pemasukan, pengeluaran, dan saldo dari SELURUH data (bukan hasil filter) */
function renderExpenseSummary() {
  const income = expenses.filter((e) => e.type === "Pemasukan").reduce((sum, e) => sum + e.amount, 0);
  const expense = expenses.filter((e) => e.type === "Pengeluaran").reduce((sum, e) => sum + e.amount, 0);

  sumIncomeEl.textContent = formatRupiah(income);
  sumExpenseEl.textContent = formatRupiah(expense);
  sumBalanceEl.textContent = formatRupiah(income - expense);
  sumBalanceEl.classList.toggle("text-rose-600", income - expense < 0);
  sumBalanceEl.classList.toggle("text-slate-900", income - expense >= 0);
}

/** Filter + urutkan, lalu bangun ulang daftar transaksi lewat DOM */
function renderExpenses() {
  const query = expenseSearch.value.trim().toLowerCase();
  const filterType = expenseFilterType.value;
  const filterCategory = expenseFilterCategory.value;
  const sort = expenseSort.value;

  let items = expenses.filter((e) => {
    const matchQuery = e.title.toLowerCase().includes(query);
    const matchType = !filterType || e.type === filterType;
    const matchCategory = !filterCategory || e.category === filterCategory;
    return matchQuery && matchType && matchCategory;
  });

  items = [...items].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "amount-desc":
        return b.amount - a.amount;
      case "amount-asc":
        return a.amount - b.amount;
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  expenseEmpty.classList.toggle("hidden", expenses.length !== 0);
  expenseList.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600";
    li.textContent = expenses.length === 0
      ? "Belum ada catatan. Tambahkan transaksi pertama Anda."
      : "Tidak ada transaksi yang cocok dengan pencarian/filter.";
    expenseList.appendChild(li);
    renderExpenseSummary();
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 px-4 py-3";
    li.dataset.id = item.id;

    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";

    const titleRow = document.createElement("p");
    titleRow.className = "font-medium text-slate-900 truncate";
    titleRow.textContent = item.title;

    const badgeRow = document.createElement("div");
    badgeRow.className = "mt-1 flex flex-wrap items-center gap-2 text-xs";

    const typeBadge = document.createElement("span");
    const isIncome = item.type === "Pemasukan";
    typeBadge.className = `inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
      isIncome ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
    }`;
    typeBadge.innerHTML = `<i aria-hidden="true" class="ti ${isIncome ? "ti-arrow-up" : "ti-arrow-down"}"></i> ${item.type}`;

    const catBadge = document.createElement("span");
    catBadge.className = "inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium";
    catBadge.textContent = item.category;

    const dateBadge = document.createElement("span");
    dateBadge.className = "text-slate-500";
    dateBadge.textContent = item.date;

    badgeRow.append(typeBadge, catBadge, dateBadge);
    info.append(titleRow, badgeRow);

    const amountEl = document.createElement("p");
    amountEl.className = `font-display font-bold text-base sm:mr-2 ${isIncome ? "text-emerald-700" : "text-rose-700"}`;
    amountEl.textContent = (isIncome ? "+" : "-") + formatRupiah(item.amount);

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-1.5 shrink-0";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";
    editBtn.innerHTML = '<i aria-hidden="true" class="ti ti-pencil"></i> Ubah';
    editBtn.addEventListener("click", () => openEditExpenseModal(item.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50";
    deleteBtn.innerHTML = '<i aria-hidden="true" class="ti ti-trash"></i> Hapus';
    deleteBtn.addEventListener("click", () => openDeleteExpenseModal(item.id));

    actions.append(editBtn, deleteBtn);
    li.append(info, amountEl, actions);
    expenseList.appendChild(li);
  });

  renderExpenseSummary();
}

function openEditExpenseModal(id) {
  const item = expenses.find((e) => e.id === id);
  if (!item) return;
  editingExpenseId = id;
  editExpenseTitle.value = item.title;
  editExpenseCategory.value = item.category;
  editExpenseAmount.value = item.amount;
  editExpenseType.value = item.type;
  editExpenseDate.value = item.date;
  openModal(modalExpenseEdit);
  editExpenseTitle.focus();
}

function openDeleteExpenseModal(id) {
  const item = expenses.find((e) => e.id === id);
  if (!item) return;
  deletingExpenseId = id;
  expenseDeleteTitle.textContent = `"${item.title}"`;
  openModal(modalExpenseDelete);
}

// Tambah transaksi baru
expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = expenseTitle.value.trim();
  const amount = Number(expenseAmount.value);

  if (!title || !expenseDate.value) return;
  if (!Number.isFinite(amount) || amount <= 0) {
    expenseAmount.focus();
    return;
  }

  expenses.push({
    id: makeId(),
    title,
    category: expenseCategory.value,
    amount,
    type: expenseType.value,
    date: expenseDate.value,
    createdAt: Date.now(),
  });

  saveExpenses();
  expenseForm.reset();
  expenseType.value = "Pengeluaran";
  renderExpenses();
});

// Simpan perubahan dari modal ubah
expenseEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = editExpenseTitle.value.trim();
  const amount = Number(editExpenseAmount.value);
  if (!title || !editingExpenseId || !Number.isFinite(amount) || amount <= 0) return;

  const item = expenses.find((x) => x.id === editingExpenseId);
  if (item) {
    item.title = title;
    item.category = editExpenseCategory.value;
    item.amount = amount;
    item.type = editExpenseType.value;
    item.date = editExpenseDate.value;
    saveExpenses();
    renderExpenses();
  }
  editingExpenseId = null;
  closeModal(modalExpenseEdit);
});

// Konfirmasi hapus
expenseDeleteConfirm.addEventListener("click", () => {
  if (!deletingExpenseId) return;
  expenses = expenses.filter((x) => x.id !== deletingExpenseId);
  saveExpenses();
  renderExpenses();
  deletingExpenseId = null;
  closeModal(modalExpenseDelete);
});

expenseSearch.addEventListener("input", renderExpenses);
expenseFilterType.addEventListener("change", renderExpenses);
expenseFilterCategory.addEventListener("change", renderExpenses);
expenseSort.addEventListener("change", renderExpenses);

populateExpenseCategories();
renderExpenses();

/* ========================================================
   2) BOOKMARK / LINK MANAGER
   ======================================================== */

const BOOKMARK_KEY = "kotak-harian-bookmarks";

let bookmarks = loadBookmarks();
let editingBookmarkId = null;
let deletingBookmarkId = null;

const bookmarkForm = $("#bookmark-form");
const bookmarkName = $("#bookmark-name");
const bookmarkUrl = $("#bookmark-url");
const bookmarkCategory = $("#bookmark-category");
const bookmarkNote = $("#bookmark-note");
const bookmarkUrlError = $("#bookmark-url-error");

const bookmarkSearch = $("#bookmark-search");
const bookmarkSort = $("#bookmark-sort");
const bookmarkList = $("#bookmark-list");
const bookmarkEmpty = $("#bookmark-empty");

const modalBookmarkEdit = $("#modal-bookmark-edit");
const bookmarkEditForm = $("#bookmark-edit-form");
const editBookmarkName = $("#edit-bookmark-name");
const editBookmarkUrl = $("#edit-bookmark-url");
const editBookmarkCategory = $("#edit-bookmark-category");
const editBookmarkNote = $("#edit-bookmark-note");

const modalBookmarkDelete = $("#modal-bookmark-delete");
const bookmarkDeleteTitle = $("#bookmark-delete-title");
const bookmarkDeleteConfirm = $("#bookmark-delete-confirm");

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks() {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
}

/** Validasi URL sederhana: wajib diawali http:// atau https:// */
function isValidUrl(value) {
  return /^https?:\/\/.+/i.test(value.trim());
}

function renderBookmarks() {
  const query = bookmarkSearch.value.trim().toLowerCase();
  const sort = bookmarkSort.value;

  let items = bookmarks.filter((b) =>
    b.name.toLowerCase().includes(query) ||
    b.url.toLowerCase().includes(query) ||
    b.category.toLowerCase().includes(query)
  );

  items = [...items].sort((a, b) => {
    switch (sort) {
      case "title-asc":
        return a.name.localeCompare(b.name, "id");
      case "title-desc":
        return b.name.localeCompare(a.name, "id");
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  bookmarkEmpty.classList.toggle("hidden", bookmarks.length !== 0);
  bookmarkList.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600";
    li.textContent = bookmarks.length === 0
      ? "Belum ada tautan tersimpan. Tambahkan bookmark pertama Anda."
      : "Tidak ada tautan yang cocok dengan pencarian.";
    bookmarkList.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "flex flex-col sm:flex-row sm:items-start gap-3 rounded-xl border border-slate-200 px-4 py-3";
    li.dataset.id = item.id;

    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "font-medium text-indigo-700 hover:underline break-words";
    link.textContent = item.name;

    const urlText = document.createElement("p");
    urlText.className = "text-xs text-slate-500 truncate";
    urlText.textContent = item.url;

    const meta = document.createElement("div");
    meta.className = "mt-1 flex flex-wrap items-center gap-2 text-xs";
    const catBadge = document.createElement("span");
    catBadge.className = "inline-flex px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium";
    catBadge.textContent = item.category || "Umum";
    meta.append(catBadge);

    info.append(link, urlText, meta);

    if (item.note) {
      const note = document.createElement("p");
      note.className = "mt-1 text-sm text-slate-600";
      note.textContent = item.note;
      info.append(note);
    }

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-1.5 shrink-0";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";
    editBtn.innerHTML = '<i aria-hidden="true" class="ti ti-pencil"></i> Ubah';
    editBtn.addEventListener("click", () => openEditBookmarkModal(item.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50";
    deleteBtn.innerHTML = '<i aria-hidden="true" class="ti ti-trash"></i> Hapus';
    deleteBtn.addEventListener("click", () => openDeleteBookmarkModal(item.id));

    actions.append(editBtn, deleteBtn);
    li.append(info, actions);
    bookmarkList.appendChild(li);
  });
}

function openEditBookmarkModal(id) {
  const item = bookmarks.find((b) => b.id === id);
  if (!item) return;
  editingBookmarkId = id;
  editBookmarkName.value = item.name;
  editBookmarkUrl.value = item.url;
  editBookmarkCategory.value = item.category;
  editBookmarkNote.value = item.note || "";
  openModal(modalBookmarkEdit);
  editBookmarkName.focus();
}

function openDeleteBookmarkModal(id) {
  const item = bookmarks.find((b) => b.id === id);
  if (!item) return;
  deletingBookmarkId = id;
  bookmarkDeleteTitle.textContent = `"${item.name}"`;
  openModal(modalBookmarkDelete);
}

bookmarkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = bookmarkName.value.trim();
  const url = bookmarkUrl.value.trim();

  bookmarkUrlError.classList.add("hidden");

  if (!name) return;
  if (!isValidUrl(url)) {
    bookmarkUrlError.classList.remove("hidden");
    bookmarkUrl.focus();
    return;
  }

  bookmarks.push({
    id: makeId(),
    name,
    url,
    category: bookmarkCategory.value.trim() || "Umum",
    note: bookmarkNote.value.trim(),
    createdAt: Date.now(),
  });

  saveBookmarks();
  bookmarkForm.reset();
  renderBookmarks();
});

bookmarkEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = editBookmarkName.value.trim();
  const url = editBookmarkUrl.value.trim();
  if (!name || !isValidUrl(url) || !editingBookmarkId) return;

  const item = bookmarks.find((b) => b.id === editingBookmarkId);
  if (item) {
    item.name = name;
    item.url = url;
    item.category = editBookmarkCategory.value.trim() || "Umum";
    item.note = editBookmarkNote.value.trim();
    saveBookmarks();
    renderBookmarks();
  }
  editingBookmarkId = null;
  closeModal(modalBookmarkEdit);
});

bookmarkDeleteConfirm.addEventListener("click", () => {
  if (!deletingBookmarkId) return;
  bookmarks = bookmarks.filter((b) => b.id !== deletingBookmarkId);
  saveBookmarks();
  renderBookmarks();
  deletingBookmarkId = null;
  closeModal(modalBookmarkDelete);
});

bookmarkSearch.addEventListener("input", renderBookmarks);
bookmarkSort.addEventListener("change", renderBookmarks);

renderBookmarks();

/* ========================================================
   3) QUIZ APP — Kuis Dasar Pemrograman Web
   ======================================================== */

const QUIZ_HIGHSCORE_KEY = "kotak-harian-quiz-highscore";

/** Bank soal disimpan sebagai array of object, bukan hardcode HTML */
const QUIZ_QUESTIONS = [
  {
    question: "Tag HTML apa yang digunakan untuk membuat tautan?",
    options: ["<link>", "<a>", "<href>", "<nav>"],
    answer: 1,
  },
  {
    question: "Properti CSS apa yang mengatur jarak di dalam elemen (antara konten dan border)?",
    options: ["margin", "padding", "gap", "border-spacing"],
    answer: 1,
  },
  {
    question: "Fungsi JavaScript untuk mengubah string JSON menjadi objek adalah...",
    options: ["JSON.stringify()", "JSON.toObject()", "JSON.parse()", "Object.fromJSON()"],
    answer: 2,
  },
  {
    question: "Metode array JavaScript apa yang menghasilkan array baru berisi elemen yang lolos suatu kondisi?",
    options: ["map()", "filter()", "reduce()", "forEach()"],
    answer: 1,
  },
  {
    question: "Layout CSS yang paling cocok untuk menyusun elemen dalam satu baris atau kolom secara fleksibel adalah...",
    options: ["Flexbox", "Float", "Table", "Position absolute"],
    answer: 0,
  },
  {
    question: "Web storage yang datanya tetap tersimpan meskipun browser ditutup dan dibuka lagi adalah...",
    options: ["sessionStorage", "cookie httpOnly", "localStorage", "cache memory"],
    answer: 2,
  },
];

let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

const quizIntro = $("#quiz-intro");
const quizPlaying = $("#quiz-playing");
const quizResult = $("#quiz-result");

const quizStartBtn = $("#quiz-start");
const quizAgainBtn = $("#quiz-again");
const quizNextBtn = $("#quiz-next");

const quizCurrentEl = $("#quiz-current");
const quizTotalEl = $("#quiz-total");
const quizScoreLiveEl = $("#quiz-score-live");
const quizQuestionEl = $("#quiz-question");
const quizOptionsEl = $("#quiz-options");

const quizFinalScoreEl = $("#quiz-final-score");
const quizHighscoreEl = $("#quiz-highscore");
const quizNewRecordEl = $("#quiz-new-record");

function getQuizHighscore() {
  const v = localStorage.getItem(QUIZ_HIGHSCORE_KEY);
  return v ? Number(v) : 0;
}

function showQuizState(state) {
  quizIntro.classList.toggle("hidden", state !== "intro");
  quizPlaying.classList.toggle("hidden", state !== "playing");
  quizResult.classList.toggle("hidden", state !== "result");
}

function startQuiz() {
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  quizTotalEl.textContent = String(QUIZ_QUESTIONS.length);
  showQuizState("playing");
  renderQuizQuestion();
}

/** Render pertanyaan aktif beserta 4 opsinya lewat DOM */
function renderQuizQuestion() {
  const q = QUIZ_QUESTIONS[quizIndex];
  quizAnswered = false;
  quizCurrentEl.textContent = String(quizIndex + 1);
  quizScoreLiveEl.textContent = String(quizScore);
  quizQuestionEl.textContent = q.question;
  quizNextBtn.disabled = true;
  quizOptionsEl.innerHTML = "";

  q.options.forEach((optionText, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option w-full text-left rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 transition";
    btn.textContent = optionText;
    btn.addEventListener("click", () => selectQuizAnswer(idx, btn));
    quizOptionsEl.appendChild(btn);
  });
}

/** Cocokkan jawaban dipilih dengan kunci, beri highlight benar/salah */
function selectQuizAnswer(selectedIdx, selectedBtn) {
  if (quizAnswered) return;
  quizAnswered = true;

  const q = QUIZ_QUESTIONS[quizIndex];
  const optionButtons = $all("#quiz-options .quiz-option");

  optionButtons.forEach((btn, idx) => {
    btn.disabled = true;
    // Lepas efek hover supaya warna benar/salah tidak tertimpa
    btn.classList.remove("hover:border-indigo-300", "hover:bg-indigo-50");
    if (idx === q.answer) {
      btn.classList.add("border-emerald-400", "bg-emerald-50", "text-emerald-800");
    } else if (idx === selectedIdx) {
      btn.classList.add("border-rose-400", "bg-rose-50", "text-rose-800");
    }
  });

  if (selectedIdx === q.answer) {
    quizScore += 1;
    quizScoreLiveEl.textContent = String(quizScore);
  }

  quizNextBtn.disabled = false;
}

function goToNextQuestion() {
  quizIndex += 1;
  if (quizIndex >= QUIZ_QUESTIONS.length) {
    finishQuiz();
  } else {
    renderQuizQuestion();
  }
}

function finishQuiz() {
  const highscore = getQuizHighscore();
  const isNewRecord = quizScore > highscore;
  if (isNewRecord) {
    localStorage.setItem(QUIZ_HIGHSCORE_KEY, String(quizScore));
  }

  quizFinalScoreEl.textContent = `${quizScore} / ${QUIZ_QUESTIONS.length}`;
  quizHighscoreEl.textContent = `${Math.max(quizScore, highscore)} / ${QUIZ_QUESTIONS.length}`;
  quizNewRecordEl.classList.toggle("hidden", !isNewRecord);

  showQuizState("result");
}

quizStartBtn.addEventListener("click", startQuiz);
quizAgainBtn.addEventListener("click", startQuiz);
quizNextBtn.addEventListener("click", goToNextQuestion);

// Tampilkan high score di layar intro sebelum kuis dimulai
$("#quiz-intro-highscore").textContent = `${getQuizHighscore()} / ${QUIZ_QUESTIONS.length}`;
showQuizState("intro");
