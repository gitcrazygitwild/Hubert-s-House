// app.js — Hubert’s House (v12.1)
// Firebase sync + password gate + theme dice + search (with date popover)
// Owner filter (hanry/karena includes "both"), swipe months, jump-to-month
// Details modal (read-only) + Edit modal + Checklist-only modal
// Focus mode (✨): hides panels + strengthens calendar contrast + "focus" indicator light (blue)
// Cat mode (🐾): floating paw prints + paw button highlight + indicator light (orange)
//
// Fixes requested:
// 1) Multi-day events not showing last day -> FullCalendar expects all-day end to be exclusive.
//    We normalize stored all-day events so end becomes (inclusive end + 1 day) when rendering,
//    and we reverse that when showing/editing/saving.
// 3) Searching switches to List view; list duration is based on Dates popover (From/To),
//    falling back to 14 days when no date bounds. (No longer tied to a separate list-range.)
// 5) Focus mode: actually helps focus by hiding side panels and reducing visual noise (CSS hooks)
// 6) Mode light: orange in cat mode, blue in focus mode, off otherwise (and focus wins if both)
// 7) Dealer’s choice: "Purr" micro-confirmation toast on save + subtle now chip time update

window.addEventListener("error", function (e) {
  alert("JS Error: " + e.message);
});

// ---------- Gate ----------
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
  closeModal();
  closeTaskModal();
  closeJumpModal();
  closeDetails();
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

// ---------- Top controls ----------
const nowChip = document.getElementById("nowChip");
const logoutBtn = document.getElementById("logoutBtn");
const todayBtn = document.getElementById("todayBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const themeBtn = document.getElementById("themeBtn");

const catModeBtn = document.getElementById("catModeBtn");
const focusBtn = document.getElementById("focusBtn");
const modeLight = document.getElementById("modeLight");
const catLayer = document.getElementById("catLayer");

logoutBtn?.addEventListener("click", lock);

// Dealer’s choice #7: live-ish time chip
function tickNowChip() {
  if (!nowChip) return;
  const d = new Date();
  const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  nowChip.textContent = `Ready • ${t}`;
}
tickNowChip();
setInterval(tickNowChip, 30 * 1000);

// ---------- Search ----------
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");

const searchFiltersBtn = document.getElementById("searchFiltersBtn");
const searchFilters = document.getElementById("searchFilters");
const searchFrom = document.getElementById("searchFrom");
const searchTo = document.getElementById("searchTo");
const clearDatesBtn = document.getElementById("clearDatesBtn");
const closeSearchFiltersBtn = document.getElementById("closeSearchFiltersBtn");

const ownerFilter = document.getElementById("ownerFilter");

// Panels
const upcomingListEl = document.getElementById("upcomingList");
const outstandingListEl = document.getElementById("outstandingList");
const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");

// ---------- Modals: Edit ----------
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

// ---------- Details modal (read-only) ----------
const detailsBackdrop = document.getElementById("detailsBackdrop");
const detailsClose = document.getElementById("detailsClose");
const detailsOwnerPill = document.getElementById("detailsOwnerPill");
const detailsTitle = document.getElementById("detailsTitle");
const detailsWhen = document.getElementById("detailsWhen");
const detailsType = document.getElementById("detailsType");
const detailsNotes = document.getElementById("detailsNotes");
const detailsChecklist = document.getElementById("detailsChecklist");
const detailsEditBtn = document.getElementById("detailsEditBtn");
const detailsChecklistBtn = document.getElementById("detailsChecklistBtn");
const detailsDeleteBtn = document.getElementById("detailsDeleteBtn");

// ---------- Checklist-only modal ----------
const taskBackdrop = document.getElementById("taskBackdrop");
const taskClose = document.getElementById("taskClose");
const taskDone = document.getElementById("taskDone");
const taskMeta = document.getElementById("taskMeta");
const taskChecklist = document.getElementById("taskChecklist");
const taskAddItem = document.getElementById("taskAddItem");

// ---------- Jump-to-month modal ----------
const jumpBackdrop = document.getElementById("jumpBackdrop");
const jumpClose = document.getElementById("jumpClose");
const jumpCancel = document.getElementById("jumpCancel");
const jumpGoBtn = document.getElementById("jumpGoBtn");
const jumpMonthSelect = document.getElementById("jumpMonthSelect");
const jumpYearSelect = document.getElementById("jumpYearSelect");

// ---------- FAB ----------
const fab = document.getElementById("fab");

// ---------- Theme ----------
const THEMES = ["aurora", "sunset", "mint", "grape", "mono"];
function pickTheme() {
  const t = THEMES[Math.floor(Math.random() * THEMES.length)];
  document.documentElement.dataset.theme = t;
}
themeBtn?.addEventListener("click", () => pickTheme());
pickTheme();

// ---------- Cat Mode + Focus Mode + Mode Light ----------
const LS_CAT = "huberts_house_cat_mode_v1";
const LS_FOCUS = "huberts_house_focus_mode_v1";

function setModeLight() {
  // focus wins over cat
  const html = document.documentElement;
  const focusOn = html.classList.contains("focus-on");
  const catOn = html.classList.contains("cat-mode");
  if (!modeLight) return;
  modeLight.style.opacity = (focusOn || catOn) ? "1" : "0.8";
}

function setCatMode(on) {
  const html = document.documentElement;
  html.classList.toggle("cat-mode", !!on);
  if (catLayer) catLayer.classList.toggle("hidden", !on);
  if (on) localStorage.setItem(LS_CAT, "1");
  else localStorage.removeItem(LS_CAT);
  // start/stop paws
  if (on) startPaws();
  else stopPaws();
  setModeLight();
}
function toggleCatMode() {
  const html = document.documentElement;
  setCatMode(!html.classList.contains("cat-mode"));
}

function setFocusMode(on) {
  const html = document.documentElement;
  html.classList.toggle("focus-on", !!on);
  if (on) localStorage.setItem(LS_FOCUS, "1");
  else localStorage.removeItem(LS_FOCUS);
  // focus mode is mostly CSS-driven (hides panels, boosts contrast)
  setModeLight();
}
function toggleFocusMode() {
  const html = document.documentElement;
  setFocusMode(!html.classList.contains("focus-on"));
}

catModeBtn?.addEventListener("click", toggleCatMode);
focusBtn?.addEventListener("click", toggleFocusMode);

// restore modes
setCatMode(localStorage.getItem(LS_CAT) === "1");
setFocusMode(localStorage.getItem(LS_FOCUS) === "1");

// ---------- Search popover behavior ----------
function openSearchPopover() {
  if (!searchFilters || !searchFiltersBtn) return;
  searchFilters.classList.remove("hidden");
  searchFiltersBtn.classList.add("is-active");
  searchFiltersBtn.setAttribute("aria-expanded", "true");
}
function closeSearchPopover() {
  if (!searchFilters || !searchFiltersBtn) return;
  searchFilters.classList.add("hidden");
  searchFiltersBtn.classList.remove("is-active");
  searchFiltersBtn.setAttribute("aria-expanded", "false");
}
searchFiltersBtn?.addEventListener("click", () => {
  if (!searchFilters) return;
  const open = !searchFilters.classList.contains("hidden");
  if (open) closeSearchPopover();
  else openSearchPopover();
});
closeSearchFiltersBtn?.addEventListener("click", closeSearchPopover);

document.addEventListener("click", (e) => {
  if (!searchFilters || searchFilters.classList.contains("hidden")) return;
  const wrap = searchFiltersBtn?.closest(".search-wrap");
  if (wrap && !wrap.contains(e.target)) closeSearchPopover();
});

clearDatesBtn?.addEventListener("click", () => {
  if (searchFrom) searchFrom.value = "";
  if (searchTo) searchTo.value = "";
  applySearchAndFilters(true);
});

searchClearBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  applySearchAndFilters(true);
});

logoutBtn?.addEventListener("click", lock);

// ---------- Colors / owners ----------
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

// Owner filter includes "both" when hanry or karena selected
let ownerFilterValue = "all";
function matchOwnerForFilter(eventOwner) {
  const o = normalizeOwner(eventOwner);
  if (!ownerFilterValue || ownerFilterValue === "all") return true;
  if (ownerFilterValue === "hanry" || ownerFilterValue === "karena") {
    return o === ownerFilterValue || o === "both";
  }
  return o === ownerFilterValue;
}

// ---------- Checklist presets ----------
const CHECKLIST_PRESETS = {
  general: [],
  wedding: ["RSVP", "Gift", "Travel", "Outfit", "Hotel"],
  trip: ["Book travel", "Lodging", "Packing list", "Car / rides", "Itinerary"],
  appointment: ["Add address", "Bring ID", "Arrive early", "Paperwork"],
  party: ["Invite list", "Food/drinks", "Music", "Supplies", "Cleanup plan"]
};

// ---------- Firebase (CDN imports ONLY) ----------
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

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBEXNyX6vIbHwGCpI3fpVUb5llubOjt9qQ",
  authDomain: "huberts-house.firebaseapp.com",
  projectId: "huberts-house",
  storageBucket: "huberts-house.firebasestorage.app",
  messagingSenderId: "233498547172",
  appId: "1:233498547172:web:e250d2f14b0e19c6322df1",
  measurementId: "G-CX5MN6WBFP"
};

let db, eventsCol;
let calendar;

// In-memory cache
let rawDocs = [];         // [{id,...data}]
let expandedEvents = [];  // normalized + expanded repeats (each has sourceId)

let editingDocId = null;
let editingOccurrenceStart = null;

// For Details modal selection
let viewingDocId = null;
let viewingOccurrenceStart = null;

// Outstanding pagination
let outstandingPage = 1;
const OUT_PAGE_SIZE = 10;

// Search state
let searchText = "";

// ---------- Init ----------
async function initApp() {
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

    expandedEvents = expandRepeats(normalizeDocs(rawDocs));
    renderCalendarFromCache();
    renderPanels();
  }, (err) => {
    console.error(err);
    alert("Sync error. Check Firestore rules.");
  });
}

// ---------- UI hooks ----------
function initUIHooks() {
  todayBtn?.addEventListener("click", () => calendar?.today());
  prevBtn?.addEventListener("click", () => calendar?.prev());
  nextBtn?.addEventListener("click", () => calendar?.next());

  // Search debounce; when searching, switch to list and use dates range
  let t = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      searchText = (searchInput.value || "").trim();
      applySearchAndFilters(true);
    }, 180);
  });

  searchFrom?.addEventListener("change", () => applySearchAndFilters(true));
  searchTo?.addEventListener("change", () => applySearchAndFilters(true));

  ownerFilter?.addEventListener("change", () => {
    ownerFilterValue = ownerFilter.value || "all";
    applySearchAndFilters(false);
  });

  fab?.addEventListener("click", () => {
    const start = roundToNextHour(new Date());
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openEditModal(makeBlankPayload({ start, end }));
  });

  modalClose?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  evtAllDay?.addEventListener("change", () => {
    preserveDatesOnAllDayToggle(!!evtAllDay.checked);
  });

  evtOwner?.addEventListener("change", () => {
    const v = evtOwner.value;
    ownerCustomWrap?.classList.toggle("hidden", v !== "custom");
    if (v !== "custom" && evtOwnerCustom) evtOwnerCustom.value = "";
  });

  evtRepeat?.addEventListener("change", () => {
    const v = evtRepeat.value;
    repeatUntilWrap?.classList.toggle("hidden", v === "none");
  });

  evtType?.addEventListener("change", () => maybeAutofillChecklist(evtType.value));

  addCheckItemBtn?.addEventListener("click", () => {
    addChecklistItemUI(checklistEl, { text: "", done: false }, true);
  });

  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSave();
  });

  deleteBtn?.addEventListener("click", async () => {
    if (!editingDocId) return;
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", editingDocId));
    closeModal();
  });

  // Details modal hooks
  detailsClose?.addEventListener("click", closeDetails);
  detailsBackdrop?.addEventListener("click", (e) => {
    if (e.target === detailsBackdrop) closeDetails();
  });

  detailsEditBtn?.addEventListener("click", () => {
    if (!viewingDocId) return;
    const docData = rawDocs.find(d => d.id === viewingDocId);
    if (!docData) return;
    closeDetails();
    openEditModal(docToEditPayload(docData, viewingOccurrenceStart));
  });

  detailsChecklistBtn?.addEventListener("click", () => {
    if (!viewingDocId) return;
    const docData = rawDocs.find(d => d.id === viewingDocId);
    if (!docData) return;
    openTaskModal(docData, viewingOccurrenceStart);
  });

  detailsDeleteBtn?.addEventListener("click", async () => {
    if (!viewingDocId) return;
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", viewingDocId));
    closeDetails();
  });

  // Checklist modal hooks
  taskClose?.addEventListener("click", closeTaskModal);
  taskDone?.addEventListener("click", closeTaskModal);
  taskBackdrop?.addEventListener("click", (e) => {
    if (e.target === taskBackdrop) closeTaskModal();
  });
  taskAddItem?.addEventListener("click", () => {
    addChecklistItemUI(taskChecklist, { text: "", done: false }, true);
  });

  // Jump-to-month hooks
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

  populateYearSelect();
}

// ---------- Calendar ----------
function initCalendarUI() {
  const calendarEl = document.getElementById("calendar");

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "", // we use our own prev/next buttons
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listBtn"
    },
    customButtons: {
      listBtn: { text: "List", click: () => openListViewFromSearchBounds() }
    },
    views: {
      listCustom: { type: "list", duration: { days: 14 }, buttonText: "List" }
    },

    selectable: true,
    editable: true,
    nowIndicator: true,
    height: "auto",
    longPressDelay: 350,
    selectLongPressDelay: 350,

    datesSet: () => hookMonthTitleClick(),

    // Monthly day click: go to day view for that date (requested earlier)
    dateClick: (info) => {
      if (calendar?.view?.type === "dayGridMonth") {
        calendar.changeView("timeGridDay", info.date);
        return;
      }
      // Otherwise create event
      const start = new Date(info.date);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      openEditModal(makeBlankPayload({ start, end }));
    },

    select: (info) => {
      const start = info.start;
      const end = info.end || new Date(start.getTime() + 60 * 60 * 1000);
      openEditModal(makeBlankPayload({ start, end, allDay: info.allDay }));
    },

    // Click event -> Details modal (clean) with Edit button
    eventClick: (info) => {
      const ev = info.event;
      const p = ev.extendedProps || {};
      const sourceId = p.sourceId || ev.id;

      const docData = rawDocs.find(d => d.id === sourceId);
      if (!docData) return;

      openDetails(docData, ev.start ? new Date(ev.start) : null);
    },

    eventDidMount: (arg) => {
      const show = shouldShowEvent(arg.event);
      if (!show) arg.el.style.display = "none";

      const p = arg.event.extendedProps || {};
      if (p.isRepeatOccurrence) {
        arg.event.setProp("editable", false);
        arg.event.setProp("durationEditable", false);
        arg.event.setProp("startEditable", false);
      }

      arg.el.style.fontSize = "var(--event-font)";
    },

    eventDrop: async (info) => {
      const p = info.event.extendedProps || {};
      if (p.isRepeatOccurrence) {
        info.revert();
        alert("Repeating events: edit the series instead (no single-instance moves yet).");
        return;
      }
      await persistMovedEvent(info.event);
    },

    eventResize: async (info) => {
      const p = info.event.extendedProps || {};
      if (p.isRepeatOccurrence) {
        info.revert();
        alert("Repeating events: edit the series instead (no single-instance resizes yet).");
        return;
      }
      await persistMovedEvent(info.event);
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
  title.title = "Jump to month";
  title.onclick = () => openJumpModalFromCalendar();
}

function openJumpModalFromCalendar() {
  if (!calendar) return;
  const d = calendar.getDate();
  if (jumpMonthSelect) jumpMonthSelect.value = String(d.getMonth());
  if (jumpYearSelect) jumpYearSelect.value = String(d.getFullYear());
  jumpBackdrop?.classList.remove("hidden");
}
function closeJumpModal() {
  jumpBackdrop?.classList.add("hidden");
}
function populateYearSelect() {
  if (!jumpYearSelect) return;
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now - 5; y <= now + 10; y++) years.push(y);
  jumpYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  jumpYearSelect.value = String(now);
}

// Swipe left/right to change months/weeks
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

// ---------- Rendering ----------
function renderCalendarFromCache() {
  if (!calendar) return;
  calendar.removeAllEvents();
  for (const e of getVisibleEvents()) calendar.addEvent(e);

  // If search is active, keep user in list view
  if (isSearchActive()) openListViewFromSearchBounds();
}

function renderPanels() {
  renderUpcoming();
  renderOutstanding();
}

function getVisibleEvents() {
  let list = expandedEvents.slice();
  list = list.filter((e) => matchOwnerFilterEvent(e));
  list = list.filter((e) => matchSearch(e));

  const bounds = getSearchBounds();
  if (bounds) {
    const { from, to } = bounds;
    list = list.filter((e) => {
      const s = new Date(e.start).getTime();
      // if no start, ignore
      if (from && s < from.getTime()) return false;
      if (to && s > to.getTime()) return false;
      return true;
    });
  }
  return list;
}

function shouldShowEvent(fcEvent) {
  const p = fcEvent.extendedProps || {};
  if (!matchOwnerForFilter(p.owner)) return false;

  if (searchText) {
    const hay = `${fcEvent.title} ${p.notes || ""} ${p.type || ""} ${p.ownerCustom || ""}`.toLowerCase();
    if (!hay.includes(searchText.toLowerCase())) return false;
  }

  const bounds = getSearchBounds();
  if (bounds) {
    const s = fcEvent.start ? fcEvent.start.getTime() : 0;
    if (bounds.from && s < bounds.from.getTime()) return false;
    if (bounds.to && s > bounds.to.getTime()) return false;
  }

  return true;
}

function matchOwnerFilterEvent(e) {
  const p = e.extendedProps || {};
  return matchOwnerForFilter(p.owner);
}

function matchSearch(e) {
  if (!searchText) return true;
  const p = e.extendedProps || {};
  const hay = `${e.title} ${p.notes || ""} ${p.type || ""} ${p.ownerCustom || ""}`.toLowerCase();
  return hay.includes(searchText.toLowerCase());
}

function getSearchBounds() {
  const fromVal = searchFrom?.value || "";
  const toVal = searchTo?.value || "";
  if (!fromVal && !toVal) return null;

  const from = fromVal ? new Date(fromVal + "T00:00:00") : null;
  const to = toVal ? new Date(toVal + "T23:59:59") : null;
  return { from, to };
}

function isSearchActive() {
  const b = getSearchBounds();
  return !!(searchText || b);
}

function applySearchAndFilters(switchToListIfSearching) {
  searchText = (searchInput?.value || "").trim();

  renderCalendarFromCache();
  renderPanels();

  if (switchToListIfSearching && isSearchActive()) {
    openListViewFromSearchBounds();
  }
}

// Search-driven list duration: based on date bounds
function openListViewFromSearchBounds() {
  if (!calendar) return;

  const bounds = getSearchBounds();
  const hasBounds = !!bounds;
  let days = 14;

  if (hasBounds) {
    const from = bounds.from || new Date();
    const to = bounds.to || new Date(from.getTime() + 14 * 86400000);
    const span = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
    days = Math.max(1, Math.min(span, 120));
  }

  calendar.setOption("views", {
    listCustom: { type: "list", duration: { days }, buttonText: "List" }
  });

  // if user clicks Month/Week/Day, FullCalendar will switch normally; our list button uses listCustom
  calendar.changeView("listCustom");

  if (bounds?.from) calendar.gotoDate(bounds.from);
  else calendar.gotoDate(new Date());
}

// ---------- Upcoming ----------
function renderUpcoming() {
  if (!upcomingListEl) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  let list = expandedEvents.slice();
  list = list.filter(matchOwnerFilterEvent);
  list = list.filter(matchSearch);

  const upcoming = [];
  for (const e of list) {
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end) : null;
    const isAllDay = !!e.allDay;

    if (isAllDay) {
      if (start.getTime() >= todayStart.getTime()) upcoming.push(e);
      continue;
    }

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
  upcomingListEl.querySelectorAll("[data-open-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-open-id");
      const occ = el.getAttribute("data-occ");
      openDetailsFromPanel(id, occ);
    });
  });
}

// ---------- Outstanding ----------
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

  let list = expandedEvents.slice();
  list = list.filter(matchOwnerFilterEvent);
  list = list.filter(matchSearch);

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
  outstandingListEl.querySelectorAll("[data-open-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-open-id");
      const occ = el.getAttribute("data-occ");
      openDetailsFromPanel(id, occ);
    });
  });
}

function openDetailsFromPanel(sourceId, occurrenceStartISO) {
  const docData = rawDocs.find(d => d.id === sourceId);
  if (!docData) return;
  const occStart = occurrenceStartISO ? new Date(occurrenceStartISO) : (docData.start ? new Date(docData.start) : null);
  openDetails(docData, occStart);
}

// ---------- Details modal ----------
function openDetails(docData, occurrenceStart) {
  viewingDocId = docData.id;
  viewingOccurrenceStart = occurrenceStart || (docData.start ? new Date(docData.start) : null);

  const owner = normalizeOwner(docData.owner);
  const ownerLabel = owner === "custom" ? (docData.ownerCustom || "Other") : owner;

  const when = formatWhenForDetails({
    start: viewingOccurrenceStart || (docData.start ? new Date(docData.start) : null),
    end: docData.end ? new Date(docData.end) : null,
    allDay: !!docData.allDay,
    // for all-day multi-day: show inclusive end
    inclusiveAllDayEnd: docData.end ? new Date(docData.end) : null
  });

  if (detailsOwnerPill) detailsOwnerPill.textContent = ownerLabel;
  if (detailsTitle) detailsTitle.textContent = docData.title || "";
  if (detailsWhen) detailsWhen.textContent = when;

  if (detailsType) detailsType.textContent = docData.type || "general";
  if (detailsNotes) detailsNotes.textContent = (docData.notes || "").trim() || "—";

  const items = Array.isArray(docData.checklist) ? docData.checklist : [];
  if (detailsChecklist) {
    if (items.length === 0) detailsChecklist.textContent = "—";
    else detailsChecklist.textContent = items.map(it => `${it.done ? "✅" : "⬜"} ${it.text}`).join("\n");
  }

  detailsBackdrop?.classList.remove("hidden");
}

function closeDetails() {
  viewingDocId = null;
  viewingOccurrenceStart = null;
  detailsBackdrop?.classList.add("hidden");
}

// ---------- Edit modal ----------
function makeBlankPayload({ start, end, allDay=false }) {
  return {
    mode: "create",
    title: "",
    start,
    end,
    allDay,
    owner: "both",
    ownerCustom: "",
    type: "general",
    repeat: "none",
    repeatUntil: "",
    notes: "",
    checklist: []
  };
}

function docToEditPayload(docData, occurrenceStart) {
  return {
    mode: "edit",
    id: docData.id,
    occurrenceStart: occurrenceStart || (docData.start ? new Date(docData.start) : null),
    title: docData.title || "",
    start: docData.start ? new Date(docData.start) : (occurrenceStart || new Date()),
    end: docData.end ? new Date(docData.end) : null,
    allDay: !!docData.allDay,
    owner: normalizeOwner(docData.owner),
    ownerCustom: docData.ownerCustom || "",
    type: docData.type || "general",
    repeat: docData.repeat || "none",
    repeatUntil: docData.repeatUntil || "",
    notes: docData.notes || "",
    checklist: Array.isArray(docData.checklist) ? docData.checklist : []
  };
}

function openEditModal(payload) {
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

  // IMPORTANT: if all-day and multi-day, we show inclusive end (human-friendly)
  const start = payload.start;
  const end = payload.end;

  setDateTimeInputs(!!payload.allDay, start, end);

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

function setDateTimeInputs(isAllDay, startDate, endDate) {
  if (!evtStart || !evtEnd) return;

  evtStart.type = isAllDay ? "date" : "datetime-local";
  evtEnd.type = isAllDay ? "date" : "datetime-local";

  evtStart.value = toInputValue(startDate, isAllDay);

  // For all-day events, our stored end is INCLUSIVE (e.g., Jan 10 means includes Jan 10).
  // The input should show that inclusive date.
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

// ---------- Save / persist ----------
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

  // STORE all-day end as inclusive date (human-friendly).
  // When rendering into FullCalendar, we will convert to exclusive end (+1 day) so it shows the last day.
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
    purrToast("Saved ✅");
  } else {
    await addDoc(eventsCol, { ...payload, createdAt: serverTimestamp() });
    purrToast("Added ✅");
  }

  closeModal();
}

// When dragging/resizing, we store end in the same shape:
// - Timed: literal end ISO
// - All-day: inclusive end date in local time (end date = last day)
async function persistMovedEvent(fcEvent) {
  const start = fcEvent.start ? new Date(fcEvent.start) : null;
  const end = fcEvent.end ? new Date(fcEvent.end) : null;

  const allDay = !!fcEvent.allDay;

  let storeEnd = end;
  if (allDay && end) {
    // FullCalendar provides exclusive end for all-day ranges.
    // Convert to inclusive by subtracting 1 day.
    storeEnd = addDays(end, -1);
    storeEnd.setHours(0,0,0,0);
  }

  const patch = {
    start: start ? start.toISOString() : null,
    end: storeEnd ? storeEnd.toISOString() : null,
    allDay,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, "events", fcEvent.extendedProps?.sourceId || fcEvent.id), patch);
}

// ---------- Task modal ----------
let taskDocId = null;

function openTaskModal(docData, occurrenceStart) {
  taskDocId = docData.id;

  const when = formatWhenForDetails({
    start: occurrenceStart || (docData.start ? new Date(docData.start) : null),
    end: docData.end ? new Date(docData.end) : null,
    allDay: !!docData.allDay,
    inclusiveAllDayEnd: docData.end ? new Date(docData.end) : null
  });

  const owner = normalizeOwner(docData.owner);
  const ownerLabel = owner === "custom" ? (docData.ownerCustom || "Other") : owner;

  if (taskMeta) taskMeta.textContent = `${docData.title || ""} — ${when} — ${ownerLabel}`;

  renderChecklistUI(taskChecklist, Array.isArray(docData.checklist) ? docData.checklist : []);

  taskBackdrop?.classList.remove("hidden");

  taskChecklist?.addEventListener("change", taskAutoSaveHandler, { once: true });
  taskChecklist?.addEventListener("blur", taskAutoSaveHandler, { once: true, capture: true });
}

async function taskAutoSaveHandler() {
  if (!taskDocId) return;
  const checklist = readChecklistUI(taskChecklist);
  await updateDoc(doc(db, "events", taskDocId), { checklist, updatedAt: serverTimestamp() });
  taskChecklist?.addEventListener("change", taskAutoSaveHandler, { once: true });
  taskChecklist?.addEventListener("blur", taskAutoSaveHandler, { once: true, capture: true });
}

function closeTaskModal() {
  taskDocId = null;
  taskBackdrop?.classList.add("hidden");
}

// ---------- Checklist UI helpers ----------
function renderChecklistUI(container, items) {
  if (!container) return;
  const safe = Array.isArray(items) ? items : [];
  container.innerHTML = "";
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
  del.style.width = "46px";
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

// ---------- Normalize docs + expand repeats ----------
function normalizeDocs(docs) {
  return docs.map((d) => {
    const owner = normalizeOwner(d.owner);
    const start = d.start ? new Date(d.start) : null;

    // Stored end is inclusive for all-day events.
    const end = d.end ? new Date(d.end) : null;

    return {
      id: d.id,
      title: d.title || "",
      start,
      end, // inclusive for all-day; literal for timed
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

function expandRepeats(norm) {
  const horizonDays = 240;
  const now = new Date();
  const horizon = new Date(now.getTime() + horizonDays * 86400000);

  const out = [];
  for (const d of norm) {
    const style = OWNER_STYLE[d.owner] || OWNER_STYLE.custom;

    const baseProps = {
      sourceId: d.id,
      owner: d.owner,
      ownerCustom: d.ownerCustom,
      type: d.type,
      notes: d.notes,
      checklist: d.checklist
    };

    const repeat = d.repeat || "none";
    if (repeat === "none") {
      out.push(makeFcEventFromDoc(d, style, { ...baseProps, isRepeatOccurrence: false }));
      continue;
    }

    const until = d.repeatUntil ? new Date(d.repeatUntil + "T23:59:59") : horizon;
    const stop = until.getTime() < horizon.getTime() ? until : horizon;

    let cur = new Date(d.start);
    let count = 0;

    while (cur.getTime() <= stop.getTime() && count < 400) {
      const occStart = new Date(cur);

      // duration calc
      const durMs = d.end ? (new Date(d.end).getTime() - new Date(d.start).getTime()) : 0;
      const occEndIncl = d.end ? new Date(occStart.getTime() + durMs) : null;

      const occId = `${d.id}__${occStart.toISOString().slice(0,10)}`;

      out.push(makeFcEvent({
        id: occId,
        title: d.title,
        start: occStart,
        endInclusive: occEndIncl,
        allDay: d.allDay,
        style,
        extra: { ...baseProps, isRepeatOccurrence: true }
      }));

      cur = advanceRepeat(cur, repeat);
      count++;
    }
  }

  return out;
}

function makeFcEventFromDoc(doc, style, extra) {
  return makeFcEvent({
    id: doc.id,
    title: doc.title,
    start: doc.start,
    endInclusive: doc.end,
    allDay: doc.allDay,
    style,
    extra
  });
}

// Convert inclusive all-day end to FullCalendar exclusive end (+1 day)
function makeFcEvent({ id, title, start, endInclusive, allDay, style, extra }) {
  let fcEnd = undefined;

  if (endInclusive) {
    if (allDay) {
      // inclusive -> exclusive (+1 day)
      const ex = addDays(new Date(endInclusive), 1);
      ex.setHours(0,0,0,0);
      fcEnd = ex.toISOString();
    } else {
      fcEnd = new Date(endInclusive).toISOString();
    }
  }

  return {
    id,
    title,
    start: new Date(start).toISOString(),
    end: fcEnd,
    allDay: !!allDay,
    backgroundColor: style.bg,
    borderColor: style.border,
    textColor: "#e9ecf1",
    extendedProps: extra
  };
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

// ---------- Panel card rendering ----------
function renderPanelCardHTML(e) {
  const p = e.extendedProps || {};
  const owner = normalizeOwner(p.owner);
  const ownerLabel = owner === "custom" ? (p.ownerCustom || "Other") : owner;

  const when = formatWhenForDetails({
    start: new Date(e.start),
    end: e.end ? new Date(e.end) : null,
    allDay: !!e.allDay,
    inclusiveAllDayEnd: null
  });

  const style = OWNER_STYLE[owner] || OWNER_STYLE.custom;
  const pillColor = style.border;

  return `
    <div class="panel-card" data-open-id="${p.sourceId || e.id}" data-occ="${String(e.start)}" style="border-left: 5px solid ${pillColor}; cursor: pointer;">
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

  return renderPanelCardHTML(e).replace(
    "</div>\n    </div>",
    ` <span class="progress-pill">${done}/${total} (${pct}%)</span></div>\n    </div>`
  );
}

// ---------- When formatting ----------
function formatWhenForDetails({ start, end, allDay, inclusiveAllDayEnd }) {
  if (!start) return "";
  const optsDate = { weekday: "short", month: "short", day: "numeric" };
  const optsTime = { hour: "numeric", minute: "2-digit" };

  if (allDay) {
    // If multi-day all-day and we have inclusive end, show range.
    if (inclusiveAllDayEnd) {
      const s = start.toLocaleDateString(undefined, optsDate);
      const e = inclusiveAllDayEnd.toLocaleDateString(undefined, optsDate);
      if (s !== e) return `${s} → ${e} (all day)`;
    }
    return `${start.toLocaleDateString(undefined, optsDate)} (all day)`;
  }

  const d = start.toLocaleDateString(undefined, optsDate);
  const t1 = start.toLocaleTimeString(undefined, optsTime);
  if (!end) return `${d} • ${t1}`;
  const t2 = end.toLocaleTimeString(undefined, optsTime);
  return `${d} • ${t1}–${t2}`;
}

// ---------- Date helpers ----------
function toInputValue(dateObj, allDay) {
  let d = dateObj;
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d)) d = new Date();

  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  if (allDay) return `${y}-${m}-${day}`;

  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
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

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ---------- Escape ----------
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Cat paws (floating) ----------
// --- Cat mode timers (declare early so we can clear safely) ---
let pawsTimer = null;
let pawsCleanupTimer = null; // if you have a second timer

function startPaws() {
  if (!catLayer) return;
  stopPaws();
  catLayer.innerHTML = "";
  // sprinkle a few immediately
  for (let i = 0; i < 10; i++) spawnPaw();
  pawsTimer = setInterval(() => spawnPaw(), 900);
}

function stopPaws() {
  if (pawsTimer) clearInterval(pawsTimer);
  pawsTimer = null;
  if (catLayer) catLayer.innerHTML = "";
}

function spawnPaw() {
  if (!catLayer) return;
  const paw = document.createElement("div");
  paw.className = "paw";
  paw.textContent = "🐾";
  paw.style.position = "absolute";
  paw.style.left = `${Math.random() * 100}%`;
  paw.style.top = `-20px`;
  paw.style.fontSize = `${12 + Math.random() * 18}px`;
  paw.style.opacity = "0.85";
  paw.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;

  const dur = 6500 + Math.random() * 6000;
  const drift = (Math.random() * 90 - 45);

  paw.animate([
    { transform: `translate(0px, 0px) rotate(${Math.random() * 40 - 20}deg)`, opacity: 0.0 },
    { opacity: 0.85, offset: 0.12 },
    { transform: `translate(${drift}px, 120vh) rotate(${Math.random() * 60 - 30}deg)`, opacity: 0.0 }
  ], { duration: dur, easing: "linear" });

  catLayer.appendChild(paw);
  setTimeout(() => paw.remove(), dur + 50);
}

// ---------- Dealer’s choice: tiny toast ----------
let toastEl = null;
function purrToast(msg) {
  try {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = `😺 ${msg}`;
    toastEl.classList.add("show");
    toastEl.style.display = "block";
    clearTimeout(purrToast._t);
    purrToast._t = setTimeout(() => {
      if (!toastEl) return;
      toastEl.style.display = "none";
      toastEl.classList.remove("show");
    }, 1200);
  } catch { /* no-op */ }
}

// ---------- Start ----------
initApp().catch((err) => {
  console.error(err);
  alert("Firebase failed to initialize. Check firebaseConfig + Firestore rules.");
});