// app.js — Hubert’s House (v8) — PART 1/2
// Goals in this part:
// ✅ Calendar ALWAYS loads (even if something else fails)
// ✅ 🎲 button changes THEME (colors/fonts/background/designs hooks)
// ✅ Focus removed (no focusToggle references)
// NOTE: Part 2 will add back full modals, checklists, repeats, panels polish, etc.

/* ---------------- Firebase (CDN imports ONLY) ---------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ---------------- Gate ---------------- */
const PASSWORD = "Mack"; // not real security
const LS_UNLOCK = "huberts_house_unlocked_v1";

const gate = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const gateInput = document.getElementById("gateInput");
const rememberDevice = document.getElementById("rememberDevice");

let sessionUnlocked = false;

function isUnlocked() {
  if (sessionUnlocked) return true;
  return localStorage.getItem(LS_UNLOCK) === "1";
}
function unlock() {
  const remember = rememberDevice?.checked ?? true;
  if (remember) localStorage.setItem(LS_UNLOCK, "1");
  sessionUnlocked = true;
  gate?.classList.add("hidden");
}
function lock() {
  sessionUnlocked = false;
  localStorage.removeItem(LS_UNLOCK);
  gate?.classList.remove("hidden");
  // (modals are wired in Part 2)
}

gateForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = String(gateInput?.value ?? "").trim();
  if (pw.toLowerCase() === PASSWORD.toLowerCase()) {
    unlock();
    if (gateInput) gateInput.value = "";
  } else {
    if (gateInput) {
      gateInput.value = "";
      gateInput.focus();
    }
    alert("Wrong password.");
  }
});

if (isUnlocked()) gate?.classList.add("hidden");
else gate?.classList.remove("hidden");

/* ---------------- Elements ---------------- */
const logoutBtn = document.getElementById("logoutBtn");
const todayBtn = document.getElementById("todayBtn");
const themeBtn = document.getElementById("themeBtn");

const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");
const searchHint = document.getElementById("searchHint");
const searchFiltersBtn = document.getElementById("searchFiltersBtn");
const searchFilters = document.getElementById("searchFilters");
const closeSearchFiltersBtn = document.getElementById("closeSearchFiltersBtn");
const searchFrom = document.getElementById("searchFrom");
const searchTo = document.getElementById("searchTo");
const clearDatesBtn = document.getElementById("clearDatesBtn");

const listRangeSelect = document.getElementById("listRangeSelect");
const ownerFilter = document.getElementById("ownerFilter");

const fab = document.getElementById("fab");

/* ---------------- Theme (dice = true theme changes) ---------------- */
const THEMES = [
  {
    name: "aurora",
    fontUI:
      '-apple-system,system-ui,"SF Pro Display","SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    fontDisplay:
      '-apple-system,system-ui,"SF Pro Display","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    designs: 0.85
  },
  {
    name: "sunset",
    fontUI:
      '-apple-system,system-ui,"Avenir Next","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    fontDisplay:
      '"Avenir Next","Avenir","SF Pro Display",-apple-system,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    designs: 0.9
  },
  {
    name: "mint",
    fontUI:
      '-apple-system,system-ui,"Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    fontDisplay:
      '"Inter","SF Pro Display",-apple-system,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    designs: 0.75
  },
  {
    name: "grape",
    fontUI:
      '-apple-system,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    fontDisplay:
      '"Trebuchet MS","SF Pro Display",-apple-system,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    designs: 0.85
  },
  {
    name: "mono",
    fontUI:
      '-apple-system,system-ui,"SF Mono","Menlo",Consolas,monospace',
    fontDisplay:
      '"SF Mono","Menlo",Consolas,monospace',
    designs: 0.35
  }
];

let lastTheme = null;

function applyThemeByName(name) {
  const t = THEMES.find((x) => x.name === name) || THEMES[0];
  const root = document.documentElement;

  root.dataset.theme = t.name;

  // fonts (CSS uses --font-ui/--font-display)
  root.style.setProperty("--font-ui", t.fontUI);
  root.style.setProperty("--font-display", t.fontDisplay);

  // “designs” (subtle overlay in CSS)
  const on = Math.random() < t.designs;
  root.classList.toggle("designs-on", on);

  lastTheme = t.name;
}

function randomTheme() {
  let pick = THEMES[Math.floor(Math.random() * THEMES.length)].name;
  if (THEMES.length > 1 && pick === lastTheme) {
    pick = THEMES[(THEMES.findIndex((t) => t.name === pick) + 1) % THEMES.length].name;
  }
  applyThemeByName(pick);
}

themeBtn?.addEventListener("click", randomTheme);
applyThemeByName("aurora");

/* ---------------- App state ---------------- */
const OWNER_STYLE = {
  hanry:  { bg: "rgba(122,162,255,0.35)", border: "rgba(122,162,255,0.85)" },
  karena: { bg: "rgba(255,107,107,0.28)", border: "rgba(255,107,107,0.85)" },
  both:   { bg: "rgba(116,217,155,0.28)", border: "rgba(116,217,155,0.85)" },
  custom: { bg: "rgba(184,140,255,0.26)", border: "rgba(184,140,255,0.85)" }
};

function normalizeOwner(rawOwner) {
  const o = String(rawOwner || "").toLowerCase();
  if (o === "hanry") return "hanry";
  if (o === "karena") return "karena";
  if (o === "both") return "both";
  return "custom";
}

let db, eventsCol;
let calendar = null;

let rawDocs = [];     // firestore docs
let fcEvents = [];    // FullCalendar event objects

// Search/filter state
let searchText = "";
let ownerFilterValue = "all";

/* ---------------- Calendar: make it load no matter what ---------------- */
function waitForFullCalendar() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.FullCalendar?.Calendar) return resolve();
      if (Date.now() - start > 5000) return reject(new Error("FullCalendar not found"));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function initCalendarUI() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) throw new Error("Missing #calendar mount");

  calendar = new window.FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    selectable: true,
    editable: true,
    nowIndicator: true,
    height: "auto",
    longPressDelay: 350,
    selectLongPressDelay: 350,

    // Keep callbacks SAFE for now (modals in Part 2)
    dateClick: (info) => {
      // quick-create placeholder (Part 2 will open modal)
      const d = new Date(info.date);
      d.setHours(9, 0, 0, 0);
      quickCreateAt(d);
    },

    eventClick: (info) => {
      // placeholder: Part 2 will open edit modal
      const title = info.event?.title || "Event";
      alert(title);
    },

    eventDidMount: (arg) => {
      // apply live filtering without crashing
      const show = shouldShowEvent(arg.event);
      if (!show) arg.el.style.display = "none";
      arg.el.style.fontSize = "var(--event-font)";
    },

    eventDrop: async (info) => {
      // prevent errors if not connected yet
      try { await persistMovedEvent(info.event); }
      catch (e) { console.error(e); info.revert(); }
    },

    eventResize: async (info) => {
      try { await persistMovedEvent(info.event); }
      catch (e) { console.error(e); info.revert(); }
    }
  });

  calendar.render();
  hookMonthTitleClick();
  attachSwipe(calendarEl);
}

function hookMonthTitleClick() {
  const title = document.querySelector(".fc-toolbar-title");
  if (!title) return;
  title.style.cursor = "pointer";
  title.title = "Jump to month (coming next)";
  // jump modal wired in Part 2
}

function attachSwipe(el) {
  let sx = 0, sy = 0, st = 0;
  el.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    st = Date.now();
  }, { passive: true });

  el.addEventListener("touchend", (e) => {
    const dt = Date.now() - st;
    if (dt > 650) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - sx;
    const dy = touch.clientY - sy;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > 45) return;
    if (dx < 0) calendar?.next();
    else calendar?.prev();
  }, { passive: true });
}

/* ---------------- Rendering ---------------- */
function buildFcEventsFromDocs(docs) {
  // For v8 Part 1: render single-instance events only (repeat expansion comes in Part 2)
  return docs
    .map((d) => {
      const owner = normalizeOwner(d.owner);
      const style = OWNER_STYLE[owner] || OWNER_STYLE.custom;

      const start = d.start ? new Date(d.start) : null;
      const end = d.end ? new Date(d.end) : null;
      if (!(start instanceof Date) || isNaN(start)) return null;

      return {
        id: d.id,
        title: d.title || "",
        start: start.toISOString(),
        end: end && !isNaN(end) ? end.toISOString() : undefined,
        allDay: !!d.allDay,
        backgroundColor: style.bg,
        borderColor: style.border,
        textColor: "#e9ecf1",
        extendedProps: {
          owner,
          ownerCustom: d.ownerCustom || "",
          type: d.type || "general",
          notes: d.notes || ""
        }
      };
    })
    .filter(Boolean);
}

function renderCalendar() {
  if (!calendar) return;
  calendar.removeAllEvents();
  for (const e of getVisibleEvents()) calendar.addEvent(e);
}

function getVisibleEvents() {
  let list = fcEvents.slice();

  // owner filter
  if (ownerFilterValue && ownerFilterValue !== "all") {
    list = list.filter((e) => normalizeOwner(e.extendedProps?.owner) === ownerFilterValue);
  }

  // text search
  if (searchText) {
    const q = searchText.toLowerCase();
    list = list.filter((e) => {
      const p = e.extendedProps || {};
      const hay = `${e.title} ${p.notes || ""} ${p.type || ""} ${p.ownerCustom || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  // date bounds (only when set)
  const bounds = getSearchBounds();
  if (bounds) {
    list = list.filter((e) => {
      const s = new Date(e.start).getTime();
      if (bounds.from && s < bounds.from.getTime()) return false;
      if (bounds.to && s > bounds.to.getTime()) return false;
      return true;
    });
  }

  return list;
}

function shouldShowEvent(fcEvent) {
  // Used in eventDidMount for quick visibility
  const p = fcEvent.extendedProps || {};
  const owner = normalizeOwner(p.owner);

  if (ownerFilterValue && ownerFilterValue !== "all") {
    if (owner !== ownerFilterValue) return false;
  }

  if (searchText) {
    const q = searchText.toLowerCase();
    const hay = `${fcEvent.title} ${p.notes || ""} ${p.type || ""} ${p.ownerCustom || ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  const bounds = getSearchBounds();
  if (bounds) {
    const s = fcEvent.start ? fcEvent.start.getTime() : 0;
    if (bounds.from && s < bounds.from.getTime()) return false;
    if (bounds.to && s > bounds.to.getTime()) return false;
  }

  return true;
}

function getSearchBounds() {
  const fromVal = searchFrom?.value || "";
  const toVal = searchTo?.value || "";
  if (!fromVal && !toVal) return null;
  const from = fromVal ? new Date(fromVal + "T00:00:00") : null;
  const to = toVal ? new Date(toVal + "T23:59:59") : null;
  return { from, to };
}

/* ---------------- Search UX ---------------- */
function isSearchActive() {
  const b = getSearchBounds();
  return !!(searchText || b);
}

function setSearchUIState() {
  const active = isSearchActive();
  searchClearBtn?.classList.toggle("hidden", !searchText);
  searchFiltersBtn?.classList.toggle("hidden", !active);
  searchHint?.classList.toggle("hidden", !active);

  if (!active) {
    searchFilters?.classList.add("hidden");
    searchFiltersBtn?.classList.remove("is-active");
  }
}

function openSearchOptions() {
  if (!searchFilters || !searchFiltersBtn) return;
  searchFilters.classList.remove("hidden");
  searchFiltersBtn.classList.add("is-active");
}
function closeSearchOptions() {
  if (!searchFilters || !searchFiltersBtn) return;
  searchFilters.classList.add("hidden");
  searchFiltersBtn.classList.remove("is-active");
}

function applySearchAndFilters() {
  searchText = (searchInput?.value || "").trim();
  setSearchUIState();
  renderCalendar();
  // panels come back in Part 2
}

/* ---------------- Quick-create placeholder ---------------- */
async function quickCreateAt(startDate) {
  // Create a simple 1-hour event with a default title; Part 2 will open modal instead
  try {
    if (!db || !eventsCol) return;
    const start = new Date(startDate);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await addDoc(eventsCol, {
      title: "New event",
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      owner: "both",
      ownerCustom: "",
      type: "general",
      notes: "",
      checklist: [],
      repeat: "none",
      repeatUntil: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.error(e);
    alert("Couldn’t create event. (Firestore rules?)");
  }
}

/* ---------------- Persist move/resize ---------------- */
async function persistMovedEvent(fcEvent) {
  if (!db) return;
  await updateDoc(doc(db, "events", fcEvent.id), {
    start: fcEvent.start ? fcEvent.start.toISOString() : null,
    end: fcEvent.end ? fcEvent.end.toISOString() : null,
    allDay: !!fcEvent.allDay,
    updatedAt: serverTimestamp()
  });
}

/* ---------------- UI Hooks ---------------- */
function initUIHooks() {
  logoutBtn?.addEventListener("click", lock);
  todayBtn?.addEventListener("click", () => calendar?.today());

  // Search
  let t = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => applySearchAndFilters(), 150);
  });

  searchClearBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    searchText = "";
    applySearchAndFilters();
    searchInput?.focus();
  });

  searchFiltersBtn?.addEventListener("click", () => {
    if (!isSearchActive()) return;
    if (searchFilters?.classList.contains("hidden")) openSearchOptions();
    else closeSearchOptions();
  });

  closeSearchFiltersBtn?.addEventListener("click", closeSearchOptions);

  clearDatesBtn?.addEventListener("click", () => {
    if (searchFrom) searchFrom.value = "";
    if (searchTo) searchTo.value = "";
    applySearchAndFilters();
  });

  searchFrom?.addEventListener("change", applySearchAndFilters);
  searchTo?.addEventListener("change", applySearchAndFilters);

  // Click-outside closes options
  document.addEventListener("click", (e) => {
    if (!searchFilters || searchFilters.classList.contains("hidden")) return;
    const wrap = searchFilters.closest(".search-filters-wrap");
    if (wrap && !wrap.contains(e.target)) closeSearchOptions();
  });

  // Owner filter
  ownerFilter?.addEventListener("change", () => {
    ownerFilterValue = ownerFilter.value || "all";
    renderCalendar();
  });

  // List range kept for Part 2 list view (no-op here, but don’t crash)
  listRangeSelect?.addEventListener("change", () => {});

  // FAB
  fab?.addEventListener("click", () => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    quickCreateAt(d);
  });

  setSearchUIState();
}

/* ---------------- Init ---------------- */
async function initApp() {
  // Ensure FullCalendar exists before we try to render
  await waitForFullCalendar();

  const firebaseConfig = {
    apiKey: "AIzaSyBEXNyX6vIbHwGCpI3fpVUb5llubOjt9qQ",
    authDomain: "huberts-house.firebaseapp.com",
    projectId: "huberts-house",
    storageBucket: "huberts-house.firebasestorage.app",
    messagingSenderId: "233498547172",
    appId: "1:233498547172:web:e250d2f14b0e19c6322df1",
    measurementId: "G-CX5MN6WBFP"
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  eventsCol = collection(db, "events");

  initCalendarUI();
  initUIHooks();

  const q = query(eventsCol, orderBy("start", "asc"));
  onSnapshot(q, (snap) => {
    const docs = [];
    snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    rawDocs = docs;

    fcEvents = buildFcEventsFromDocs(rawDocs);
    renderCalendar();
  }, (err) => {
    console.error(err);
    alert("Sync error. Check Firestore rules / network.");
  });
}

initApp().catch((err) => {
  console.error(err);
  alert(
    "Calendar failed to initialize.\n\n" +
    "Open DevTools Console to see the error.\n" +
    "Common causes: FullCalendar blocked, wrong script order, or a JS syntax error."
  );
});

// --- PART 2 will re-add: full modals, checklist modal, jump-to-month modal,
// list view, panels rendering, repeat expansion, and richer quick-add UX.

// app.js — Hubert’s House (v8) — PART 2/2
// Adds back: full modals, checklist modal, panels, list view, repeat expansion,
// jump-to-month modal, and upgrades calendar handlers from Part 1 placeholders.
// IMPORTANT: This file assumes Part 1 code is ABOVE this section (same module).

/* ---------------- Elements (panels + modals) ---------------- */
const upcomingListEl = document.getElementById("upcomingList");
const outstandingListEl = document.getElementById("outstandingList");
const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");

const backdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const eventForm = document.getElementById("eventForm");
const modalTitle = document.getElementById("modalTitle");

const evtTitle = document.getElementById("evtTitle");
const evtStart = document.getElementById("evtStart");
const evtEnd = document.getElementById("evtEnd");
const evtAllDay = document.getElementById("evtAllDay");

const evtOwner = document.getElementById("evtOwner");
const ownerCustomWrap = document.getElementById("ownerCustomWrap");
const evtOwnerCustom = document.getElementById("evtOwnerCustom");

const evtType = document.getElementById("evtType");
const evtRepeat = document.getElementById("evtRepeat");
const repeatUntilWrap = document.getElementById("repeatUntilWrap");
const evtRepeatUntil = document.getElementById("evtRepeatUntil");

const checklistEl = document.getElementById("checklist");
const addCheckItemBtn = document.getElementById("addCheckItem");
const evtNotes = document.getElementById("evtNotes");

const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");

const taskBackdrop = document.getElementById("taskBackdrop");
const taskClose = document.getElementById("taskClose");
const taskDone = document.getElementById("taskDone");
const taskMeta = document.getElementById("taskMeta");
const taskChecklist = document.getElementById("taskChecklist");
const taskAddItem = document.getElementById("taskAddItem");

const jumpBackdrop = document.getElementById("jumpBackdrop");
const jumpClose = document.getElementById("jumpClose");
const jumpCancel = document.getElementById("jumpCancel");
const jumpGoBtn = document.getElementById("jumpGoBtn");
const jumpMonthSelect = document.getElementById("jumpMonthSelect");
const jumpYearSelect = document.getElementById("jumpYearSelect");

/* ---------------- State (editing + outstanding pagination) ---------------- */
let editingDocId = null;
let editingOccurrenceStart = null;

let outstandingPage = 1;
const OUT_PAGE_SIZE = 10;

const CHECKLIST_PRESETS = {
  general: [],
  wedding: ["RSVP", "Gift", "Travel", "Outfit", "Hotel"],
  trip: ["Book travel", "Lodging", "Packing list", "Car / rides", "Itinerary"],
  appointment: ["Add address", "Bring ID", "Arrive early", "Paperwork"],
  party: ["Invite list", "Food/drinks", "Music", "Supplies", "Cleanup plan"]
};

/* ---------------- Utilities ---------------- */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function toInputValue(dateObj, allDay) {
  let d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d)) d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());

  if (allDay) return `${y}-${m}-${day}`;

  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function fromInputValue(value, allDay) {
  if (!value) return new Date();
  if (allDay) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(value);
}

function roundToNextHour(d) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  x.setHours(x.getHours() + 1);
  return x;
}

function formatWhenForPanel({ start, end, allDay }) {
  if (!start) return "";
  const optsDate = { weekday: "short", month: "short", day: "numeric" };
  const optsTime = { hour: "numeric", minute: "2-digit" };

  if (allDay) return `${start.toLocaleDateString(undefined, optsDate)} (all day)`;

  const d = start.toLocaleDateString(undefined, optsDate);
  const t1 = start.toLocaleTimeString(undefined, optsTime);
  if (!end) return `${d} • ${t1}`;
  const t2 = end.toLocaleTimeString(undefined, optsTime);
  return `${d} • ${t1}–${t2}`;
}

/* ---------------- Checklist UI helpers ---------------- */
function renderChecklistUI(container, items) {
  if (!container) return;
  container.innerHTML = "";
  const safe = Array.isArray(items) ? items : [];
  for (const it of safe) addChecklistItemUI(container, it, false);
}

function addChecklistItemUI(container, item, focus) {
  if (!container) return;

  const wrap = document.createElement("div");
  wrap.className = "checkitem";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!item.done;

  const input = document.createElement("input");
  input.type = "text";
  input.value = item.text || "";
  input.placeholder = "Checklist item…";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn btn-ghost";
  del.textContent = "✕";
  del.style.width = "44px";
  del.style.padding = "10px 0";
  del.addEventListener("click", () => wrap.remove());

  wrap.appendChild(cb);
  wrap.appendChild(input);
  wrap.appendChild(del);
  container.appendChild(wrap);

  if (focus) input.focus();
}

function readChecklistUI(container) {
  if (!container) return [];
  const rows = Array.from(container.querySelectorAll(".checkitem"));
  return rows.map((row) => {
    const cb = row.querySelector('input[type="checkbox"]');
    const input = row.querySelector('input[type="text"]');
    return { text: (input?.value || "").trim(), done: !!cb?.checked };
  }).filter(it => it.text.length > 0);
}

function maybeAutofillChecklist(type) {
  if (!checklistEl) return;
  const current = readChecklistUI(checklistEl);
  if (current.length > 0) return;
  const preset = CHECKLIST_PRESETS[type] || [];
  if (preset.length === 0) return;
  renderChecklistUI(checklistEl, preset.map(t => ({ text: t, done: false })));
}

/* ---------------- Repeat expansion (full) ---------------- */
function normalizeDocsForRepeats(docs) {
  return docs.map((d) => {
    const owner = normalizeOwner(d.owner);
    const start = d.start ? new Date(d.start) : null;
    const end = d.end ? new Date(d.end) : null;
    return {
      id: d.id,
      title: d.title || "",
      start,
      end,
      allDay: !!d.allDay,
      owner,
      ownerCustom: d.ownerCustom || "",
      type: d.type || "general",
      notes: d.notes || "",
      checklist: Array.isArray(d.checklist) ? d.checklist : [],
      repeat: d.repeat || "none",
      repeatUntil: d.repeatUntil || ""
    };
  }).filter(d => d.start instanceof Date && !isNaN(d.start));
}

function advanceRepeat(date, repeat) {
  const d = new Date(date);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + 1);
  return d;
}

function makeFcEventFromNorm({ doc, occStart, occEnd, isRepeatOccurrence }) {
  const owner = doc.owner;
  const style = OWNER_STYLE[owner] || OWNER_STYLE.custom;

  const id = isRepeatOccurrence
    ? `${doc.id}__${occStart.toISOString().slice(0, 10)}`
    : doc.id;

  return {
    id,
    title: doc.title,
    start: occStart.toISOString(),
    end: occEnd ? occEnd.toISOString() : undefined,
    allDay: !!doc.allDay,
    backgroundColor: style.bg,
    borderColor: style.border,
    textColor: "#e9ecf1",
    extendedProps: {
      sourceId: doc.id,
      owner: doc.owner,
      ownerCustom: doc.ownerCustom,
      type: doc.type,
      notes: doc.notes,
      checklist: doc.checklist,
      isRepeatOccurrence: !!isRepeatOccurrence
    }
  };
}

function buildFcEventsExpanded(docs) {
  const norm = normalizeDocsForRepeats(docs);

  const horizonDays = 240;
  const now = new Date();
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const out = [];

  for (const d of norm) {
    const repeat = d.repeat || "none";

    if (repeat === "none") {
      out.push(makeFcEventFromNorm({
        doc: d,
        occStart: d.start,
        occEnd: d.end,
        isRepeatOccurrence: false
      }));
      continue;
    }

    const until = d.repeatUntil ? new Date(d.repeatUntil + "T23:59:59") : horizon;
    const stop = until.getTime() < horizon.getTime() ? until : horizon;

    let cur = new Date(d.start);
    let count = 0;

    while (cur.getTime() <= stop.getTime() && count < 500) {
      const occStart = new Date(cur);
      const durMs = d.end ? (new Date(d.end).getTime() - new Date(d.start).getTime()) : 0;
      const occEnd = d.end ? new Date(occStart.getTime() + durMs) : null;

      out.push(makeFcEventFromNorm({
        doc: d,
        occStart,
        occEnd,
        isRepeatOccurrence: true
      }));

      cur = advanceRepeat(cur, repeat);
      count++;
    }
  }

  return out;
}

/* ---------------- Calendar upgrades (handlers + list view + jump modal) ---------------- */
function populateYearSelect() {
  if (!jumpYearSelect) return;
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now - 5; y <= now + 10; y++) years.push(y);
  jumpYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  jumpYearSelect.value = String(now);
}
populateYearSelect();

function openJumpModal() {
  if (!calendar) return;
  const d = calendar.getDate();
  if (jumpMonthSelect) jumpMonthSelect.value = String(d.getMonth());
  if (jumpYearSelect) jumpYearSelect.value = String(d.getFullYear());
  jumpBackdrop?.classList.remove("hidden");
}
function closeJumpModal() {
  jumpBackdrop?.classList.add("hidden");
}

function enableCalendarUpgrades() {
  if (!calendar) return;

  // Add List button + adjustable duration
  calendar.setOption("customButtons", {
    listBtn: {
      text: "List",
      click: () => openListView()
    }
  });

  calendar.setOption("headerToolbar", {
    left: "prev,next",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay,listBtn"
  });

  // Safer interaction handlers (use modal)
  calendar.setOption("dateClick", (info) => {
    const start = new Date(info.date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openEventModal({
      mode: "create",
      title: "",
      start,
      end,
      allDay: false,
      owner: "both",
      ownerCustom: "",
      type: "general",
      repeat: "none",
      repeatUntil: "",
      notes: "",
      checklist: []
    });
  });

  calendar.setOption("select", (info) => {
    const start = info.start;
    const end = info.end || new Date(start.getTime() + 60 * 60 * 1000);
    openEventModal({
      mode: "create",
      title: "",
      start,
      end,
      allDay: info.allDay,
      owner: "both",
      ownerCustom: "",
      type: "general",
      repeat: "none",
      repeatUntil: "",
      notes: "",
      checklist: []
    });
  });

  calendar.setOption("eventClick", (info) => {
    const ev = info.event;
    const p = ev.extendedProps || {};
    const sourceId = p.sourceId || ev.id;

    const docData = rawDocs.find(d => d.id === sourceId);
    if (!docData) return;

    openEventModal({
      mode: "edit",
      id: sourceId,
      occurrenceStart: ev.start ? new Date(ev.start) : null,
      title: docData.title || "",
      start: docData.start ? new Date(docData.start) : (ev.start ? new Date(ev.start) : new Date()),
      end: docData.end ? new Date(docData.end) : (ev.end ? new Date(ev.end) : null),
      allDay: !!docData.allDay,
      owner: normalizeOwner(docData.owner),
      ownerCustom: docData.ownerCustom || "",
      type: docData.type || "general",
      repeat: docData.repeat || "none",
      repeatUntil: docData.repeatUntil || "",
      notes: docData.notes || "",
      checklist: Array.isArray(docData.checklist) ? docData.checklist : []
    });
  });

  // Title click => jump modal
  const title = document.querySelector(".fc-toolbar-title");
  if (title) {
    title.style.cursor = "pointer";
    title.title = "Jump to month";
    title.onclick = () => openJumpModal();
  }
}

function openListView() {
  if (!calendar) return;
  const days = Number(listRangeSelect?.value || 7);
  calendar.setOption("views", {
    listCustom: { type: "list", duration: { days }, buttonText: "List" }
  });
  calendar.changeView("listCustom");

  const bounds = getSearchBounds();
  if (bounds?.from) calendar.gotoDate(bounds.from);
  else calendar.gotoDate(new Date());
}

/* ---------------- Panels rendering ---------------- */
function renderPanels() {
  renderUpcoming();
  renderOutstanding();
}

function getVisibleEventsForPanels() {
  // Reuse Part 1 filtering logic by using the already-filtered event list
  // (getVisibleEvents() exists in Part 1)
  if (typeof getVisibleEvents === "function") return getVisibleEvents();
  return fcEvents.slice();
}

function renderUpcoming() {
  if (!upcomingListEl) return;

  const now = new Date();
  let list = getVisibleEventsForPanels();

  // upcoming: events starting today or later (all-day included)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const upcoming = [];
  for (const e of list) {
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end) : null;
    const isAllDay = !!e.allDay;

    if (isAllDay) {
      if (start.getTime() >= todayStart.getTime()) upcoming.push(e);
      continue;
    }

    // if today: include ongoing
    if (start.toDateString() === now.toDateString()) {
      const endTime = end ? end.getTime() : start.getTime();
      if (endTime >= now.getTime()) upcoming.push(e);
    } else if (start.getTime() > now.getTime()) {
      upcoming.push(e);
    }
  }

  upcoming.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const top = upcoming.slice(0, 5);

  if (top.length === 0) {
    upcomingListEl.textContent = "No upcoming events.";
    return;
  }

  upcomingListEl.innerHTML = top.map(renderPanelCardHTML).join("");
  wirePanelClicks(upcomingListEl, false);
}

outPrev?.addEventListener("click", () => {
  outstandingPage = Math.max(1, outstandingPage - 1);
  renderOutstanding();
});
outNext?.addEventListener("click", () => {
  outstandingPage += 1;
  renderOutstanding();
});

function renderOutstanding() {
  if (!outstandingListEl || !outPage) return;

  let list = getVisibleEventsForPanels();
  const withUnchecked = list.filter((e) => {
    const items = e.extendedProps?.checklist || [];
    return Array.isArray(items) && items.some(it => !it.done);
  });

  withUnchecked.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const totalPages = Math.max(1, Math.ceil(withUnchecked.length / OUT_PAGE_SIZE));
  outstandingPage = Math.min(outstandingPage, totalPages);

  const startIdx = (outstandingPage - 1) * OUT_PAGE_SIZE;
  const pageItems = withUnchecked.slice(startIdx, startIdx + OUT_PAGE_SIZE);

  outPage.textContent = `Page ${outstandingPage} / ${totalPages}`;

  if (pageItems.length === 0) {
    outstandingListEl.textContent = "No outstanding checklist items 🎉";
    return;
  }

  outstandingListEl.innerHTML = pageItems.map(renderPanelCardHTMLWithProgress).join("");
  wirePanelClicks(outstandingListEl, true);
}

function renderPanelCardHTML(e) {
  const p = e.extendedProps || {};
  const owner = normalizeOwner(p.owner);
  const ownerLabel = owner === "custom" ? (p.ownerCustom || "Other") : owner;

  const when = formatWhenForPanel({
    start: new Date(e.start),
    end: e.end ? new Date(e.end) : null,
    allDay: !!e.allDay
  });

  const style = OWNER_STYLE[owner] || OWNER_STYLE.custom;
  const pillColor = style.border;

  return `
    <div class="panel-card" data-open-id="${p.sourceId || e.id}" data-occ="${String(e.start)}" style="border-left: 5px solid ${pillColor};">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
        <span class="owner-pill">${escapeHtml(ownerLabel)}</span>
        <strong style="font-size: 16px;">${escapeHtml(e.title || "")}</strong>
      </div>
      <div class="tiny muted">${escapeHtml(when)}</div>
    </div>
  `;
}

function renderPanelCardHTMLWithProgress(e) {
  const p = e.extendedProps || {};
  const items = Array.isArray(p.checklist) ? p.checklist : [];
  const done = items.filter(i => i.done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const base = renderPanelCardHTML(e);
  return base.replace(
    "</div>\n    </div>",
    ` <span class="progress-pill">${done}/${total} (${pct}%)</span></div>\n    </div>`
  );
}

function wirePanelClicks(container, checklistView) {
  container.querySelectorAll("[data-open-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-open-id");
      const occ = el.getAttribute("data-occ");
      openFromPanel(id, occ, checklistView);
    });
  });
}

function openFromPanel(sourceId, occurrenceStartISO, checklistView) {
  const docData = rawDocs.find(d => d.id === sourceId);
  if (!docData) return;

  const occStart = occurrenceStartISO ? new Date(occurrenceStartISO) : null;

  if (checklistView) {
    openTaskModal(docData, occStart);
  } else {
    openEventModal({
      mode: "edit",
      id: sourceId,
      occurrenceStart: occStart,
      title: docData.title || "",
      start: docData.start ? new Date(docData.start) : (occStart || new Date()),
      end: docData.end ? new Date(docData.end) : null,
      allDay: !!docData.allDay,
      owner: normalizeOwner(docData.owner),
      ownerCustom: docData.ownerCustom || "",
      type: docData.type || "general",
      repeat: docData.repeat || "none",
      repeatUntil: docData.repeatUntil || "",
      notes: docData.notes || "",
      checklist: Array.isArray(docData.checklist) ? docData.checklist : []
    });
  }
}

/* ---------------- Event modal ---------------- */
function setDateTimeInputs(isAllDay, startDate, endDate) {
  if (!evtStart || !evtEnd) return;
  evtStart.type = isAllDay ? "date" : "datetime-local";
  evtEnd.type = isAllDay ? "date" : "datetime-local";
  evtStart.value = toInputValue(startDate, isAllDay);
  evtEnd.value = endDate ? toInputValue(endDate, isAllDay) : "";
}

function preserveDatesOnAllDayToggle(isAllDayNow) {
  if (!evtStart || !evtEnd) return;

  const prevStartVal = evtStart.value;
  const prevEndVal = evtEnd.value;

  const wasAllDay = evtStart.type === "date";
  const startDate = prevStartVal ? fromInputValue(prevStartVal, wasAllDay) : new Date();
  const endDate = prevEndVal ? fromInputValue(prevEndVal, wasAllDay) : null;

  setDateTimeInputs(isAllDayNow, startDate, endDate);
}

function openEventModal(payload) {
  const isEdit = payload.mode === "edit";

  editingDocId = isEdit ? payload.id : null;
  editingOccurrenceStart = payload.occurrenceStart || null;

  if (modalTitle) modalTitle.textContent = isEdit ? "Edit event" : "New event";
  deleteBtn?.classList.toggle("hidden", !isEdit);

  if (evtTitle) evtTitle.value = payload.title ?? "";
  if (evtAllDay) evtAllDay.checked = !!payload.allDay;

  const owner = normalizeOwner(payload.owner);
  if (evtOwner) evtOwner.value = owner;
  ownerCustomWrap?.classList.toggle("hidden", owner !== "custom");
  if (evtOwnerCustom) evtOwnerCustom.value = payload.ownerCustom || "";

  if (evtType) evtType.value = payload.type || "general";

  if (evtRepeat) evtRepeat.value = payload.repeat || "none";
  repeatUntilWrap?.classList.toggle("hidden", (payload.repeat || "none") === "none");
  if (evtRepeatUntil) evtRepeatUntil.value = payload.repeatUntil || "";

  setDateTimeInputs(!!payload.allDay, payload.start, payload.end);

  renderChecklistUI(checklistEl, payload.checklist || []);
  if (evtNotes) evtNotes.value = payload.notes || "";

  backdrop?.classList.remove("hidden");
  evtTitle?.focus();
}

function closeModal() {
  editingDocId = null;
  editingOccurrenceStart = null;
  backdrop?.classList.add("hidden");
}

/* ---------------- Task modal (checklist-only) ---------------- */
let taskDocId = null;

function openTaskModal(docData, occurrenceStart) {
  taskDocId = docData.id;

  const when = formatWhenForPanel({
    start: occurrenceStart || (docData.start ? new Date(docData.start) : null),
    end: docData.end ? new Date(docData.end) : null,
    allDay: !!docData.allDay
  });

  const owner = normalizeOwner(docData.owner);
  const ownerLabel = owner === "custom" ? (docData.ownerCustom || "Other") : owner;

  if (taskMeta) taskMeta.textContent = `${docData.title || ""} — ${when} — ${ownerLabel}`;

  renderChecklistUI(taskChecklist, Array.isArray(docData.checklist) ? docData.checklist : []);
  taskBackdrop?.classList.remove("hidden");

  // autosave (debounced-ish)
  taskChecklist?.addEventListener("change", taskAutoSaveHandler, { once: true });
  taskChecklist?.addEventListener("blur", taskAutoSaveHandler, { once: true, capture: true });
}

async function taskAutoSaveHandler() {
  try {
    if (!taskDocId) return;
    const checklist = readChecklistUI(taskChecklist);
    await updateDoc(doc(db, "events", taskDocId), { checklist, updatedAt: serverTimestamp() });
  } catch (e) {
    console.error(e);
    alert("Couldn’t save checklist (rules/network).");
  } finally {
    taskChecklist?.addEventListener("change", taskAutoSaveHandler, { once: true });
    taskChecklist?.addEventListener("blur", taskAutoSaveHandler, { once: true, capture: true });
  }
}

function closeTaskModal() {
  taskDocId = null;
  taskBackdrop?.classList.add("hidden");
}

/* ---------------- Save / delete ---------------- */
async function handleSave() {
  const title = (evtTitle?.value || "").trim();
  if (!title) return;

  const allDay = !!evtAllDay?.checked;

  const owner = normalizeOwner(evtOwner?.value || "both");
  const ownerCustom = owner === "custom" ? (evtOwnerCustom?.value || "").trim() : "";

  const type = evtType?.value || "general";
  const notes = (evtNotes?.value || "").trim();

  const repeat = evtRepeat?.value || "none";
  const repeatUntil = repeat !== "none" ? (evtRepeatUntil?.value || "") : "";

  const start = fromInputValue(evtStart?.value, allDay);
  const end = evtEnd?.value ? fromInputValue(evtEnd.value, allDay) : null;

  if (end && end.getTime() < start.getTime()) {
    alert("End must be after start.");
    return;
  }

  const checklist = readChecklistUI(checklistEl);

  const payload = {
    title,
    allDay,
    owner,
    ownerCustom,
    type,
    notes,
    checklist,
    repeat,
    repeatUntil,
    start: start.toISOString(),
    end: end ? end.toISOString() : null,
    updatedAt: serverTimestamp()
  };

  if (editingDocId) {
    await updateDoc(doc(db, "events", editingDocId), payload);
  } else {
    await addDoc(eventsCol, { ...payload, createdAt: serverTimestamp() });
  }

  closeModal();
}

/* ---------------- Modal wiring ---------------- */
modalClose?.addEventListener("click", closeModal);
cancelBtn?.addEventListener("click", closeModal);
backdrop?.addEventListener("click", (e) => {
  if (e.target === backdrop) closeModal();
});

evtAllDay?.addEventListener("change", () => preserveDatesOnAllDayToggle(!!evtAllDay.checked));

evtOwner?.addEventListener("change", () => {
  const v = evtOwner.value;
  ownerCustomWrap?.classList.toggle("hidden", v !== "custom");
  if (v !== "custom" && evtOwnerCustom) evtOwnerCustom.value = "";
});

evtRepeat?.addEventListener("change", () => {
  repeatUntilWrap?.classList.toggle("hidden", evtRepeat.value === "none");
});

evtType?.addEventListener("change", () => maybeAutofillChecklist(evtType.value));

addCheckItemBtn?.addEventListener("click", () => {
  addChecklistItemUI(checklistEl, { text: "", done: false }, true);
});

eventForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await handleSave();
  } catch (err) {
    console.error(err);
    alert("Couldn’t save (rules/network).");
  }
});

deleteBtn?.addEventListener("click", async () => {
  if (!editingDocId) return;
  if (!confirm("Delete this event?")) return;
  try {
    await deleteDoc(doc(db, "events", editingDocId));
    closeModal();
  } catch (err) {
    console.error(err);
    alert("Couldn’t delete (rules/network).");
  }
});

// Task modal controls
taskClose?.addEventListener("click", closeTaskModal);
taskDone?.addEventListener("click", closeTaskModal);
taskBackdrop?.addEventListener("click", (e) => {
  if (e.target === taskBackdrop) closeTaskModal();
});
taskAddItem?.addEventListener("click", () => {
  addChecklistItemUI(taskChecklist, { text: "", done: false }, true);
});

// Jump modal controls
jumpClose?.addEventListener("click", closeJumpModal);
jumpCancel?.addEventListener("click", closeJumpModal);
jumpBackdrop?.addEventListener("click", (e) => {
  if (e.target === jumpBackdrop) closeJumpModal();
});
jumpGoBtn?.addEventListener("click", () => {
  const month = Number(jumpMonthSelect?.value ?? 0);
  const year = Number(jumpYearSelect?.value ?? new Date().getFullYear());
  calendar?.gotoDate(new Date(year, month, 1));
  closeJumpModal();
});

/* ---------------- FAB: now opens modal (instead of quickCreate) ---------------- */
if (fab) {
  fab.onclick = () => {
    const start = roundToNextHour(new Date());
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openEventModal({
      mode: "create",
      title: "",
      start,
      end,
      allDay: false,
      owner: "both",
      ownerCustom: "",
      type: "general",
      repeat: "none",
      repeatUntil: "",
      notes: "",
      checklist: []
    });
  };
}

/* ---------------- Upgrade: live re-subscribe with expanded repeats + panels ---------------- */
let _expandedSnapUnsub = null;

function resubscribeExpanded() {
  try {
    if (!eventsCol) return; // initApp (Part 1) not ready yet
    if (_expandedSnapUnsub) return; // already subscribed

    const q2 = query(eventsCol, orderBy("start", "asc"));
    _expandedSnapUnsub = onSnapshot(q2, (snap) => {
      const docs = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
      rawDocs = docs;

      // Replace fcEvents with expanded repeat occurrences
      fcEvents = buildFcEventsExpanded(rawDocs);

      // Render calendar + panels (and keep search/filter active)
      if (typeof applySearchAndFilters === "function") applySearchAndFilters();
      if (typeof renderCalendar === "function") renderCalendar();
      renderPanels();
    }, (err) => {
      console.error(err);
      alert("Sync error (expanded). Check Firestore rules.");
    });
  } catch (e) {
    console.error(e);
  }
}

/* ---------------- Upgrade: wait for calendar/db then enhance ---------------- */
(function waitAndEnhance() {
  const start = Date.now();
  const tick = () => {
    const ready = !!calendar;
    if (ready) {
      enableCalendarUpgrades();
      resubscribeExpanded();
      // Also render panels once (in case no events yet)
      renderPanels();
      return;
    }
    if (Date.now() - start > 8000) return; // give up silently
    requestAnimationFrame(tick);
  };
  tick();
})();