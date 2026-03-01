// app.js — Hubert’s House (v12)
// Restored: Gate + Jump-to-month + full Edit modal (owner/type/repeat/checklist) + Checklist-only modal
// New UX: month day-click opens Day view, event click opens Details modal (Edit button opens Edit modal)
// Dice 🎲: theme only (fonts/colors/background/designs)
// Cat mode 🐾: brighter pawprints + cat “coat” glow rotation (does not break Flapurr link)
// Owner filter: if hanry/karena selected, also show "both"
// Search: works with date bounds (From/To) and searches across ALL cached events (not tied to list range)
// Swipe left/right to change months is back
//
// NOTE: Gate is client-side only (not real security).

// =======================
// Gate
// =======================
const PASSWORD = "Mack";
const LS_UNLOCK = "huberts_house_unlocked_v12";

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
  closeEditModal();
  closeTaskModal();
  closeJumpModal();
  closeDetailsModal();
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

// =======================
// Top controls
// =======================
const logoutBtn = document.getElementById("logoutBtn");
const todayBtn = document.getElementById("todayBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const themeBtn = document.getElementById("themeBtn");
const catModeBtn = document.getElementById("catModeBtn");
const catLayer = document.getElementById("catLayer");
const catLink = document.querySelector(".catlink");

logoutBtn?.addEventListener("click", lock);

// =======================
// Search controls
// =======================
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");

const searchFiltersBtn = document.getElementById("searchFiltersBtn");
const searchFilters = document.getElementById("searchFilters");
const closeSearchFiltersBtn = document.getElementById("closeSearchFiltersBtn");
const searchFrom = document.getElementById("searchFrom");
const searchTo = document.getElementById("searchTo");
const clearDatesBtn = document.getElementById("clearDatesBtn");

// Filter controls
const ownerFilter = document.getElementById("ownerFilter");

// Panels
const upcomingListEl = document.getElementById("upcomingList");
const outstandingListEl = document.getElementById("outstandingList");
const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");

// Floating add
const fab = document.getElementById("fab");

// =======================
// Details modal (read-only)
// =======================
const detailsBackdrop = document.getElementById("detailsBackdrop");
const detailsClose = document.getElementById("detailsClose");
const detailsTitle = document.getElementById("detailsTitle");
const detailsWhen = document.getElementById("detailsWhen");
const detailsOwnerPill = document.getElementById("detailsOwnerPill");
const detailsType = document.getElementById("detailsType");
const detailsNotes = document.getElementById("detailsNotes");
const detailsChecklist = document.getElementById("detailsChecklist");
const detailsEditBtn = document.getElementById("detailsEditBtn");
const detailsDeleteBtn = document.getElementById("detailsDeleteBtn");
const detailsChecklistBtn = document.getElementById("detailsChecklistBtn");

// =======================
// Edit modal
// =======================
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

// =======================
// Checklist-only modal
// =======================
const taskBackdrop = document.getElementById("taskBackdrop");
const taskClose = document.getElementById("taskClose");
const taskDone = document.getElementById("taskDone");
const taskMeta = document.getElementById("taskMeta");
const taskChecklist = document.getElementById("taskChecklist");
const taskAddItem = document.getElementById("taskAddItem");

// =======================
// Jump-to-month modal
// =======================
const jumpBackdrop = document.getElementById("jumpBackdrop");
const jumpClose = document.getElementById("jumpClose");
const jumpCancel = document.getElementById("jumpCancel");
const jumpGoBtn = document.getElementById("jumpGoBtn");
const jumpMonthSelect = document.getElementById("jumpMonthSelect");
const jumpYearSelect = document.getElementById("jumpYearSelect");

// =======================
// Owners / colors
// =======================
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

// Checklist presets
const CHECKLIST_PRESETS = {
  general: [],
  wedding: ["RSVP", "Gift", "Travel", "Outfit", "Hotel"],
  trip: ["Book travel", "Lodging", "Packing list", "Car / rides", "Itinerary"],
  appointment: ["Add address", "Bring ID", "Arrive early", "Paperwork"],
  party: ["Invite list", "Food/drinks", "Music", "Supplies", "Cleanup plan"]
};

// =======================
// Firebase imports
// =======================
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

// In-memory cache from Firestore
let rawDocs = [];         // [{id,...data}]
let expandedEvents = [];  // normalized + expanded repeats (each has sourceId)

let editingDocId = null;           // Firestore doc id for edit modal
let selectedSourceId = null;       // doc id for details modal / selection
let selectedOccurrenceStart = null;

// Outstanding pagination
let outstandingPage = 1;
const OUT_PAGE_SIZE = 10;

// Search/filter state
let searchText = "";
let ownerFilterValue = "all";

// =======================
// Theme (dice = theme only)
// =======================
const THEMES = ["aurora", "sunset", "mint", "grape", "mono"];

function pickTheme() {
  const t = THEMES[Math.floor(Math.random() * THEMES.length)];
  document.documentElement.dataset.theme = t;

  // optionally vary design density via a class
  const on = Math.random() < 0.75;
  document.documentElement.classList.toggle("designs-on", on);

  // rotate cat “coat” glow
  rotateCatCoat();

  // small sparkle wiggle (no-op if not styled)
  const sparkle = document.getElementById("sparkleBadge");
  if (sparkle) {
    sparkle.style.transform = "rotate(10deg)";
    setTimeout(() => (sparkle.style.transform = ""), 180);
  }
}

function rotateCatCoat() {
  if (!catLink) return;
  catLink.classList.remove("coat-1","coat-2","coat-3","coat-4");
  const cls = ["coat-1","coat-2","coat-3","coat-4"][Math.floor(Math.random()*4)];
  catLink.classList.add(cls);

  // fun quick wiggle without stopping link navigation
  catLink.classList.add("cat-wiggle");
  setTimeout(() => catLink.classList.remove("cat-wiggle"), 520);
}

themeBtn?.addEventListener("click", () => pickTheme());

// Set an initial theme
pickTheme();

// =======================
// Cat mode (pawprints)
// =======================
const LS_CATMODE = "huberts_house_cat_mode_v12";
let catMode = localStorage.getItem(LS_CATMODE) === "1";
let pawTimer = null;

function setCatMode(on) {
  catMode = !!on;
  document.documentElement.classList.toggle("cat-mode", catMode);
  localStorage.setItem(LS_CATMODE, catMode ? "1" : "0");

  if (catLayer) catLayer.classList.toggle("hidden", !catMode);

  if (catMode) startPaws();
  else stopPaws();
}

function startPaws() {
  if (!catLayer) return;
  stopPaws();
  spawnPawBurst(2);
  pawTimer = setInterval(() => spawnPaw(), 1200);
}

function stopPaws() {
  if (pawTimer) clearInterval(pawTimer);
  pawTimer = null;
  // keep existing paws; they fade naturally
}

function spawnPawBurst(n=3){
  for (let i=0;i<n;i++) setTimeout(spawnPaw, i*180);
}

function spawnPaw() {
  if (!catMode || !catLayer) return;

  const paw = document.createElement("div");
  paw.className = "paw";
  paw.textContent = "🐾";

  // brighter + bigger than before (user request)
  paw.style.position = "absolute";
  paw.style.left = `${Math.random() * 100}%`;
  paw.style.top = `${Math.random() * 100}%`;
  paw.style.fontSize = `${18 + Math.random()*18}px`;
  paw.style.opacity = String(0.55 + Math.random()*0.25);
  paw.style.filter = `drop-shadow(0 10px 18px rgba(0,0,0,.22)) saturate(1.2) brightness(1.18)`;

  // gentle drift
  const dx = (Math.random() * 140 - 70);
  const dy = (Math.random() * 180 + 80);

  paw.animate(
    [
      { transform: "translate(0,0) rotate(0deg)", opacity: Number(paw.style.opacity) },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random()*60-30}deg)`, opacity: 0 }
    ],
    { duration: 5200 + Math.random()*1400, easing: "ease-in-out", fill: "forwards" }
  );

  catLayer.appendChild(paw);
  setTimeout(() => paw.remove(), 7000);
}

catModeBtn?.addEventListener("click", () => {
  setCatMode(!catMode);
});

// Apply saved cat mode
setCatMode(catMode);

// =======================
// Search popover open/close
// =======================
searchFiltersBtn?.addEventListener("click", () => {
  const willOpen = searchFilters?.classList.contains("hidden");
  searchFilters?.classList.toggle("hidden");
  searchFiltersBtn?.classList.toggle("is-active", !!willOpen);
});
closeSearchFiltersBtn?.addEventListener("click", () => {
  searchFilters?.classList.add("hidden");
  searchFiltersBtn?.classList.remove("is-active");
});

// click-outside closes popover
document.addEventListener("click", (e) => {
  if (!searchFilters || searchFilters.classList.contains("hidden")) return;
  const wrap = searchFilters.closest(".search-wrap");
  if (wrap && !wrap.contains(e.target)) {
    searchFilters.classList.add("hidden");
    searchFiltersBtn?.classList.remove("is-active");
  }
});

clearDatesBtn?.addEventListener("click", () => {
  if (searchFrom) searchFrom.value = "";
  if (searchTo) searchTo.value = "";
  applySearchAndFilters(true);
});

// Search clear
searchClearBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  searchText = "";
  applySearchAndFilters(false);
});

// Search input debounce
function initSearchDebounce() {
  let t = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      searchText = (searchInput?.value || "").trim();
      applySearchAndFilters(true);
      // only show Dates box when user is actively searching and no dates yet
      maybeAutoOpenDates();
    }, 160);
  });

  searchFrom?.addEventListener("change", () => applySearchAndFilters(true));
  searchTo?.addEventListener("change", () => applySearchAndFilters(true));
}

function maybeAutoOpenDates() {
  if (!searchText) return;
  const hasDates = !!(searchFrom?.value || searchTo?.value);
  if (hasDates) return;

  // gentle auto-open once per session of active search
  if (!searchFilters || !searchFiltersBtn) return;
  if (searchFilters.classList.contains("hidden")) {
    searchFilters.classList.remove("hidden");
    searchFiltersBtn.classList.add("is-active");
  }
}

ownerFilter?.addEventListener("change", () => {
  ownerFilterValue = ownerFilter.value || "all";
  applySearchAndFilters(false);
});

// =======================
// Init app
// =======================
async function initApp() {
  initSearchDebounce();

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  eventsCol = collection(db, "events");

  initCalendarUI();
  initModalHandlers();

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

// =======================
// Calendar setup
// =======================
function initCalendarUI() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) {
    console.error("Missing #calendar element.");
    return;
  }

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "", // we use our own prev/today/next buttons
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
    },
    nowIndicator: true,
    height: "auto",
    selectable: true,
    editable: true,
    longPressDelay: 350,
    selectLongPressDelay: 350,

    datesSet: () => hookMonthTitleClick(),

    // Month day click: open Day view for that day (instead of new event)
    dateClick: (info) => {
      if (!calendar) return;
      const isMonth = calendar.view?.type === "dayGridMonth";
      if (isMonth) {
        calendar.gotoDate(info.date);
        calendar.changeView("timeGridDay");
        return;
      }
      // In non-month views, clicking a day/time can create an event
      const start = new Date(info.date);
      const end = new Date(start.getTime() + 60*60*1000);
      openEditModal({
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
    },

    select: (info) => {
      // drag select creates event
      const start = info.start;
      const end = info.end || new Date(start.getTime() + 60*60*1000);
      openEditModal({
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
    },

    eventClick: (info) => {
      // open Details modal (clean), not the edit form
      const ev = info.event;
      const p = ev.extendedProps || {};
      const sourceId = p.sourceId || ev.id;

      const docData = rawDocs.find(d => d.id === sourceId);
      if (!docData) return;

      selectedSourceId = sourceId;
      selectedOccurrenceStart = ev.start ? new Date(ev.start) : (docData.start ? new Date(docData.start) : null);

      openDetailsModalFromDoc(docData, selectedOccurrenceStart);
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

  // External nav buttons
  todayBtn?.addEventListener("click", () => calendar?.today());
  prevBtn?.addEventListener("click", () => calendar?.prev());
  nextBtn?.addEventListener("click", () => calendar?.next());

  // FAB = create event
  fab?.addEventListener("click", () => {
    const start = roundToNextHour(new Date());
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openEditModal({
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

// =======================
// Modal handlers
// =======================
function initModalHandlers() {
  // Edit modal close
  modalClose?.addEventListener("click", closeEditModal);
  cancelBtn?.addEventListener("click", closeEditModal);
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeEditModal();
  });

  // All-day toggle
  evtAllDay?.addEventListener("change", () => {
    preserveDatesOnAllDayToggle(!!evtAllDay.checked);
  });

  // Owner custom
  evtOwner?.addEventListener("change", () => {
    const v = evtOwner.value;
    ownerCustomWrap?.classList.toggle("hidden", v !== "custom");
    if (v !== "custom" && evtOwnerCustom) evtOwnerCustom.value = "";
  });

  // Repeat until
  evtRepeat?.addEventListener("change", () => {
    const v = evtRepeat.value;
    repeatUntilWrap?.classList.toggle("hidden", v === "none");
  });

  // Type preset checklist
  evtType?.addEventListener("change", () => {
    maybeAutofillChecklist(evtType.value);
  });

  // Checklist add item
  addCheckItemBtn?.addEventListener("click", () => {
    addChecklistItemUI(checklistEl, { text: "", done: false }, true);
  });

  // Save
  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSave();
  });

  // Delete from edit modal
  deleteBtn?.addEventListener("click", async () => {
    if (!editingDocId) return;
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", editingDocId));
    closeEditModal();
  });

  // Task modal
  taskClose?.addEventListener("click", closeTaskModal);
  taskDone?.addEventListener("click", closeTaskModal);
  taskBackdrop?.addEventListener("click", (e) => {
    if (e.target === taskBackdrop) closeTaskModal();
  });
  taskAddItem?.addEventListener("click", () => {
    addChecklistItemUI(taskChecklist, { text: "", done: false }, true);
  });

  // Jump modal
  populateYearSelect();
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

  // Details modal
  detailsClose?.addEventListener("click", closeDetailsModal);
  detailsBackdrop?.addEventListener("click", (e) => {
    if (e.target === detailsBackdrop) closeDetailsModal();
  });

  detailsEditBtn?.addEventListener("click", () => {
    if (!selectedSourceId) return;
    const docData = rawDocs.find(d => d.id === selectedSourceId);
    if (!docData) return;
    closeDetailsModal();
    openEditModalFromDoc(docData, selectedOccurrenceStart);
  });

  detailsChecklistBtn?.addEventListener("click", () => {
    if (!selectedSourceId) return;
    const docData = rawDocs.find(d => d.id === selectedSourceId);
    if (!docData) return;
    openTaskModal(docData, selectedOccurrenceStart);
  });

  detailsDeleteBtn?.addEventListener("click", async () => {
    if (!selectedSourceId) return;
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", selectedSourceId));
    closeDetailsModal();
  });
}

// =======================
// Rendering & filtering
// =======================
function renderCalendarFromCache() {
  if (!calendar) return;
  calendar.removeAllEvents();

  for (const e of getVisibleEvents()) calendar.addEvent(e);
}

function renderPanels() {
  renderUpcoming();
  renderOutstanding();
}

function getVisibleEvents() {
  let list = expandedEvents.slice();

  list = list.filter(matchOwnerFilter);
  list = list.filter(matchSearch);

  const bounds = getSearchBounds();
  if (bounds) {
    const { from, to } = bounds;
    list = list.filter((e) => {
      const s = new Date(e.start).getTime();
      if (from && s < from.getTime()) return false;
      if (to && s > to.getTime()) return false;
      return true;
    });
  }

  return list;
}

// IMPORTANT: Owner filter includes "both" when hanry or karena selected
function matchOwnerFilter(e) {
  const want = ownerFilterValue || "all";
  if (want === "all") return true;

  const o = normalizeOwner(e.extendedProps?.owner);

  if (want === "hanry" || want === "karena") {
    return o === want || o === "both";
  }
  return o === want;
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

function shouldShowEvent(fcEvent) {
  const p = fcEvent.extendedProps || {};
  const owner = normalizeOwner(p.owner);

  const want = ownerFilterValue || "all";
  if (want !== "all") {
    if (want === "hanry" || want === "karena") {
      if (!(owner === want || owner === "both")) return false;
    } else {
      if (owner !== want) return false;
    }
  }

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

function applySearchAndFilters() {
  searchText = (searchInput?.value || "").trim();
  renderCalendarFromCache();
  renderPanels();
}

// =======================
// Panels: Upcoming
// =======================
function renderUpcoming() {
  if (!upcomingListEl) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  let list = expandedEvents.slice();
  list = list.filter(matchOwnerFilter);
  list = list.filter(matchSearch);

  const bounds = getSearchBounds();
  if (bounds) {
    list = list.filter((e) => {
      const s = new Date(e.start).getTime();
      if (bounds.from && s < bounds.from.getTime()) return false;
      if (bounds.to && s > bounds.to.getTime()) return false;
      return true;
    });
  }

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
      openFromPanel(id, occ, false);
    });
  });
}

// =======================
// Panels: Outstanding
// =======================
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
  list = list.filter(matchOwnerFilter);
  list = list.filter(matchSearch);

  const bounds = getSearchBounds();
  if (bounds) {
    list = list.filter((e) => {
      const s = new Date(e.start).getTime();
      if (bounds.from && s < bounds.from.getTime()) return false;
      if (bounds.to && s > bounds.to.getTime()) return false;
      return true;
    });
  }

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
      openFromPanel(id, occ, true);
    });
  });
}

function openFromPanel(sourceId, occurrenceStartISO, checklistView) {
  const docData = rawDocs.find(d => d.id === sourceId);
  if (!docData) return;

  const occStart = occurrenceStartISO ? new Date(occurrenceStartISO) : (docData.start ? new Date(docData.start) : null);

  selectedSourceId = sourceId;
  selectedOccurrenceStart = occStart;

  if (checklistView) {
    openTaskModal(docData, occStart);
  } else {
    openDetailsModalFromDoc(docData, occStart);
  }
}

// =======================
// Details modal
// =======================
function openDetailsModalFromDoc(docData, occurrenceStart) {
  if (!detailsBackdrop) return;

  const start = occurrenceStart || (docData.start ? new Date(docData.start) : null);
  const end = docData.end ? new Date(docData.end) : null;
  const allDay = !!docData.allDay;

  const owner = normalizeOwner(docData.owner);
  const ownerLabel = owner === "custom" ? (docData.ownerCustom || "Other") : owner;

  if (detailsTitle) detailsTitle.textContent = docData.title || "";
  if (detailsWhen) detailsWhen.textContent = formatWhenForPanel({ start, end, allDay });
  if (detailsOwnerPill) detailsOwnerPill.textContent = ownerLabel;
  if (detailsType) detailsType.textContent = docData.type || "general";
  if (detailsNotes) detailsNotes.textContent = (docData.notes || "").trim() || "—";

  const items = Array.isArray(docData.checklist) ? docData.checklist : [];
  if (detailsChecklist) {
    if (items.length === 0) detailsChecklist.textContent = "—";
    else {
      const done = items.filter(i => i.done).length;
      detailsChecklist.textContent = `${done}/${items.length} complete`;
    }
  }

  detailsBackdrop.classList.remove("hidden");
}

function closeDetailsModal() {
  detailsBackdrop?.classList.add("hidden");
}

// =======================
// Edit modal
// =======================
function openEditModalFromDoc(docData, occurrenceStart) {
  openEditModal({
    mode: "edit",
    id: docData.id,
    occurrenceStart: occurrenceStart || (docData.start ? new Date(docData.start) : null),
    title: docData.title || "",
    start: docData.start ? new Date(docData.start) : occurrenceStart,
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

function openEditModal(payload) {
  const isEdit = payload.mode === "edit";

  editingDocId = isEdit ? payload.id : null;

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

function closeEditModal() {
  editingDocId = null;
  backdrop?.classList.add("hidden");
}

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

  closeEditModal();
}

async function persistMovedEvent(fcEvent) {
  const patch = {
    start: fcEvent.start ? fcEvent.start.toISOString() : null,
    end: fcEvent.end ? fcEvent.end.toISOString() : null,
    allDay: fcEvent.allDay,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, "events", fcEvent.id), patch);
}

// =======================
// Checklist-only modal (autosave)
// =======================
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

  // attach autosave handlers
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

// =======================
// Checklist UI helpers
// =======================
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

// =======================
// Normalize docs + expand repeats
// =======================
function normalizeDocs(docs) {
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

function expandRepeats(norm) {
  const horizonDays = 365;
  const now = new Date();
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const out = [];
  for (const d of norm) {
    const style = OWNER_STYLE[d.owner] || OWNER_STYLE.custom;

    const base = {
      sourceId: d.id,
      owner: d.owner,
      ownerCustom: d.ownerCustom,
      type: d.type,
      notes: d.notes,
      checklist: d.checklist
    };

    const repeat = d.repeat || "none";
    if (repeat === "none") {
      out.push(makeFcEvent({
        id: d.id,
        title: d.title,
        start: d.start,
        end: d.end,
        allDay: d.allDay,
        style,
        extra: { ...base, isRepeatOccurrence: false }
      }));
      continue;
    }

    const until = d.repeatUntil ? new Date(d.repeatUntil + "T23:59:59") : horizon;
    const stop = until.getTime() < horizon.getTime() ? until : horizon;

    let cur = new Date(d.start);
    let count = 0;

    while (cur.getTime() <= stop.getTime() && count < 600) {
      const occStart = new Date(cur);
      const durMs = d.end ? (new Date(d.end).getTime() - new Date(d.start).getTime()) : 0;
      const occEndAdj = d.end ? new Date(occStart.getTime() + durMs) : null;

      const occId = `${d.id}__${occStart.toISOString().slice(0,10)}`;

      out.push(makeFcEvent({
        id: occId,
        title: d.title,
        start: occStart,
        end: occEndAdj,
        allDay: d.allDay,
        style,
        extra: { ...base, isRepeatOccurrence: true }
      }));

      cur = advanceRepeat(cur, repeat);
      count++;
    }
  }

  return out;
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

function makeFcEvent({ id, title, start, end, allDay, style, extra }) {
  return {
    id,
    title,
    start: start.toISOString(),
    end: end ? end.toISOString() : undefined,
    allDay: !!allDay,
    backgroundColor: style.bg,
    borderColor: style.border,
    textColor: "#eef1f7",
    extendedProps: extra
  };
}

// =======================
// Panel card rendering
// =======================
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

// =======================
// Date helpers
// =======================
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

// =======================
// Escape
// =======================
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =======================
// Start
// =======================
initApp().catch((err) => {
  console.error(err);
  alert("Firebase failed to initialize. Check firebaseConfig + Firestore rules.");
});