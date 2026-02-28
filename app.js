// app.js — Hubert’s House (v7) — PART 1/2
// Updates in v7:
// - Removed Sync pill usage entirely
// - 🎲 theme button ONLY randomizes theme (no calendar view cycling)
// - Removed quick-add button by search (no quickAddBtn)
// - Search Options (date range) only appears when user is actively searching
// - Added search clear (searchClearBtn) + closeSearchFiltersBtn
// - FAB remains fixed via CSS; JS unchanged there

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

// ---------- Gate ----------
const PASSWORD = "Mack"; // not real security
const LS_UNLOCK = "huberts_house_unlocked_v1";

const gate = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const gateInput = document.getElementById("gateInput");
const rememberDevice = document.getElementById("rememberDevice");

// Allow temporary unlock without localStorage (if remember unchecked)
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

// Show/hide gate immediately
if (isUnlocked()) gate?.classList.add("hidden");
else gate?.classList.remove("hidden");

// ---------- Controls ----------
const logoutBtn = document.getElementById("logoutBtn");
const todayBtn = document.getElementById("todayBtn");
const themeBtn = document.getElementById("themeBtn");

// Focus toggle (now in top row; id unchanged)
const focusToggle = document.getElementById("focusToggle");

// Search + options
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");

const searchHint = document.getElementById("searchHint");
const searchFiltersBtn = document.getElementById("searchFiltersBtn");
const searchFilters = document.getElementById("searchFilters");
const closeSearchFiltersBtn = document.getElementById("closeSearchFiltersBtn");

const searchFrom = document.getElementById("searchFrom");
const searchTo = document.getElementById("searchTo");
const clearDatesBtn = document.getElementById("clearDatesBtn");

// Filters/tools
const listRangeSelect = document.getElementById("listRangeSelect");
const ownerFilter = document.getElementById("ownerFilter");

// Panels
const upcomingListEl = document.getElementById("upcomingList");
const outstandingListEl = document.getElementById("outstandingList");
const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");

// FAB
const fab = document.getElementById("fab");

logoutBtn?.addEventListener("click", lock);
todayBtn?.addEventListener("click", () => calendar?.today());

// Focus mode: hide panels, resize calendar
focusToggle?.addEventListener("change", () => {
  const on = !!focusToggle.checked;
  document.body.classList.toggle("focus-on", on);

  const upcoming = document.getElementById("upcoming");
  const outstanding = document.getElementById("outstanding");
  if (upcoming) upcoming.style.display = on ? "none" : "";
  if (outstanding) outstanding.style.display = on ? "none" : "";

  setTimeout(() => calendar?.updateSize?.(), 60);
});

// ---------- Theme (dice only changes theme) ----------
const THEMES = ["aurora", "sunset", "mint", "grape", "mono"];
function pickTheme() {
  const t = THEMES[Math.floor(Math.random() * THEMES.length)];
  document.documentElement.dataset.theme = t;
  document.documentElement.classList.toggle("designs-on", Math.random() < 0.75);
}
themeBtn?.addEventListener("click", pickTheme);
pickTheme();

// ---------- Firebase config ----------
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
let expandedEvents = [];  // normalized + expanded repeats

// Outstanding pagination
let outstandingPage = 1;
const OUT_PAGE_SIZE = 10;

// Search state
let searchText = "";

// Filter state
let ownerFilterValue = "all";

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
    alert("Sync error. Check Firestore rules / network.");
  });
}

// ---------- Search UX helpers ----------
function isSearchActive() {
  const b = getSearchBounds();
  return !!(searchText || b);
}

function setSearchUIState() {
  const active = isSearchActive();

  // show/hide clear button
  if (searchClearBtn) searchClearBtn.classList.toggle("hidden", !searchText);

  // Options button only relevant while searching
  if (searchFiltersBtn) searchFiltersBtn.classList.toggle("hidden", !active);

  // Subtle hint while searching
  if (searchHint) searchHint.classList.toggle("hidden", !active);

  // If not searching, make sure popover is closed
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

// ---------- UI hooks ----------
function initUIHooks() {
  // Search debounce
  let t = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      searchText = (searchInput.value || "").trim();
      applySearchAndFilters(true);

      // If user typed something (or cleared), update UI state
      setSearchUIState();

      // If user started searching and hasn't opened options yet, keep it closed (clean)
      // (They can tap "Options" to open.)
    }, 150);
  });

  // Clear search
  searchClearBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    searchText = "";
    applySearchAndFilters(false);
    setSearchUIState();
    searchInput?.focus();
  });

  // Options open/close
  searchFiltersBtn?.addEventListener("click", () => {
    // only allow if searching
    if (!isSearchActive()) return;
    if (searchFilters?.classList.contains("hidden")) openSearchOptions();
    else closeSearchOptions();
  });

  closeSearchFiltersBtn?.addEventListener("click", () => {
    closeSearchOptions();
  });

  // Date filters
  searchFrom?.addEventListener("change", () => {
    applySearchAndFilters(true);
    setSearchUIState();
  });
  searchTo?.addEventListener("change", () => {
    applySearchAndFilters(true);
    setSearchUIState();
  });

  clearDatesBtn?.addEventListener("click", () => {
    if (searchFrom) searchFrom.value = "";
    if (searchTo) searchTo.value = "";
    applySearchAndFilters(true);
    setSearchUIState();
  });

  // Click-outside closes options
  document.addEventListener("click", (e) => {
    if (!searchFilters || searchFilters.classList.contains("hidden")) return;
    const wrap = searchFilters.closest(".search-filters-wrap");
    if (wrap && !wrap.contains(e.target)) closeSearchOptions();
  });

  listRangeSelect?.addEventListener("change", () => {
    if (calendar && calendar.view?.type === "listCustom") openListView();
    else renderPanels();
  });

  ownerFilter?.addEventListener("change", () => {
    ownerFilterValue = ownerFilter.value || "all";
    applySearchAndFilters(false);
  });

  fab?.addEventListener("click", () => {
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
  });

  // set initial search UI state
  setSearchUIState();
}

// ---------- Calendar ----------
function initCalendarUI() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listBtn"
    },
    customButtons: {
      listBtn: { text: "List", click: () => openListView() }
    },
    views: {
      listCustom: { type: "list", duration: { days: 7 }, buttonText: "List" }
    },
    selectable: true,
    editable: true,
    nowIndicator: true,
    height: "auto",
    longPressDelay: 350,
    selectLongPressDelay: 350,

    datesSet: () => hookMonthTitleClick(),

    dateClick: (info) => {
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
    },

    select: (info) => {
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
    },

    eventClick: (info) => {
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
        start: docData.start ? new Date(docData.start) : ev.start,
        end: docData.end ? new Date(docData.end) : ev.end,
        allDay: !!docData.allDay,
        owner: normalizeOwner(docData.owner),
        ownerCustom: docData.ownerCustom || "",
        type: docData.type || "general",
        repeat: docData.repeat || "none",
        repeatUntil: docData.repeatUntil || "",
        notes: docData.notes || "",
        checklist: Array.isArray(docData.checklist) ? docData.checklist : []
      });
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

// --- PART 2 continues with: modals (event/task/jump), rendering/panels,
// filters/search/list view helpers, repeat expansion, misc helpers, and initApp() start. ---

// app.js — Hubert’s House (v7) — PART 2/2
// Continues from Part 1

// ---------- Modal: event editor ----------
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

// Editing state
let editingDocId = null;
let editingOccurrenceStart = null;

// ---------- Checklist modal ----------
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

// ---------- Modal wiring ----------
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
  repeatUntilWrap?.classList.toggle("hidden", evtRepeat.value === "none");
});

evtType?.addEventListener("change", () => {
  maybeAutofillChecklist(evtType.value);
});

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

// Task modal wiring
taskClose?.addEventListener("click", closeTaskModal);
taskDone?.addEventListener("click", closeTaskModal);
taskBackdrop?.addEventListener("click", (e) => {
  if (e.target === taskBackdrop) closeTaskModal();
});
taskAddItem?.addEventListener("click", () => {
  addChecklistItemUI(taskChecklist, { text: "", done: false }, true);
});

// Jump modal wiring
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

function hookMonthTitleClick() {
  const title = document.querySelector(".fc-toolbar-title");
  if (!title) return;
  title.style.cursor = "pointer";
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
populateYearSelect();

// ---------- Swipe ----------
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

function matchOwnerFilter(e) {
  if (!ownerFilterValue || ownerFilterValue === "all") return true;
  return normalizeOwner(e.extendedProps?.owner) === ownerFilterValue;
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

// ---------- Upcoming ----------
function renderUpcoming() {
  if (!upcomingListEl) return;

  const now = new Date();
  let list = getVisibleEvents();

  const upcoming = list.filter(e => new Date(e.start).getTime() >= now.getTime());
  upcoming.sort((a,b)=>new Date(a.start)-new Date(b.start));

  const top = upcoming.slice(0,5);
  if (top.length === 0) {
    upcomingListEl.textContent = "No upcoming events.";
    return;
  }

  upcomingListEl.innerHTML = top.map(renderPanelCardHTML).join("");
  wirePanelClicks(upcomingListEl);
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

  let list = getVisibleEvents();
  const withUnchecked = list.filter(e => {
    const items = e.extendedProps?.checklist || [];
    return Array.isArray(items) && items.some(it => !it.done);
  });

  withUnchecked.sort((a,b)=>new Date(a.start)-new Date(b.start));

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

function wirePanelClicks(container, checklistView=false) {
  container.querySelectorAll("[data-open-id]").forEach((el)=>{
    el.addEventListener("click", ()=>{
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
      start: docData.start ? new Date(docData.start) : occStart,
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

// ---------- Event modal ----------
function openEventModal(payload) {
  const isEdit = payload.mode === "edit";
  editingDocId = isEdit ? payload.id : null;
  editingOccurrenceStart = payload.occurrenceStart || null;

  modalTitle.textContent = isEdit ? "Edit event" : "New event";
  deleteBtn?.classList.toggle("hidden", !isEdit);

  evtTitle.value = payload.title ?? "";
  evtAllDay.checked = !!payload.allDay;

  const owner = normalizeOwner(payload.owner);
  evtOwner.value = owner;
  ownerCustomWrap.classList.toggle("hidden", owner !== "custom");
  evtOwnerCustom.value = payload.ownerCustom || "";

  evtType.value = payload.type || "general";
  evtRepeat.value = payload.repeat || "none";
  repeatUntilWrap.classList.toggle("hidden", evtRepeat.value === "none");
  evtRepeatUntil.value = payload.repeatUntil || "";

  setDateTimeInputs(!!payload.allDay, payload.start, payload.end);
  renderChecklistUI(checklistEl, payload.checklist || []);
  evtNotes.value = payload.notes || "";

  backdrop.classList.remove("hidden");
  evtTitle.focus();
}

function closeModal() {
  editingDocId = null;
  editingOccurrenceStart = null;
  backdrop?.classList.add("hidden");
}

async function handleSave() {
  const title = evtTitle.value.trim();
  if (!title) return;

  const allDay = !!evtAllDay.checked;
  const owner = normalizeOwner(evtOwner.value || "both");
  const ownerCustom = owner === "custom" ? evtOwnerCustom.value.trim() : "";
  const type = evtType.value || "general";
  const notes = evtNotes.value.trim();
  const repeat = evtRepeat.value || "none";
  const repeatUntil = repeat !== "none" ? evtRepeatUntil.value : "";

  const start = fromInputValue(evtStart.value, allDay);
  const end = evtEnd.value ? fromInputValue(evtEnd.value, allDay) : null;

  if (end && end.getTime() < start.getTime()) {
    alert("End must be after start.");
    return;
  }

  const checklist = readChecklistUI(checklistEl);

  const payload = {
    title, allDay, owner, ownerCustom, type, notes,
    checklist, repeat, repeatUntil,
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

async function persistMovedEvent(fcEvent) {
  await updateDoc(doc(db, "events", fcEvent.id), {
    start: fcEvent.start?.toISOString(),
    end: fcEvent.end?.toISOString(),
    allDay: fcEvent.allDay,
    updatedAt: serverTimestamp()
  });
}

// ---------- Checklist helpers ----------
function renderChecklistUI(container, items) {
  container.innerHTML = "";
  (items || []).forEach(it => addChecklistItemUI(container, it, false));
}

function addChecklistItemUI(container, item, focus) {
  const wrap = document.createElement("div");
  wrap.className = "checkitem";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!item.done;

  const input = document.createElement("input");
  input.type = "text";
  input.value = item.text || "";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn btn-ghost";
  del.textContent = "✕";
  del.style.width = "44px";

  del.addEventListener("click", () => wrap.remove());

  wrap.append(cb,input,del);
  container.appendChild(wrap);
  if (focus) input.focus();
}

function readChecklistUI(container) {
  return Array.from(container.querySelectorAll(".checkitem")).map(row=>{
    const cb=row.querySelector('input[type="checkbox"]');
    const input=row.querySelector('input[type="text"]');
    return { text: input.value.trim(), done: cb.checked };
  }).filter(it=>it.text.length>0);
}

// ---------- Normalize + repeats ----------
function normalizeOwner(rawOwner) {
  const o = String(rawOwner||"").toLowerCase();
  if (o==="hanry") return "hanry";
  if (o==="karena") return "karena";
  if (o==="both") return "both";
  return "custom";
}

function normalizeDocs(docs){
  return docs.map(d=>{
    const start=d.start?new Date(d.start):null;
    const end=d.end?new Date(d.end):null;
    return {
      id:d.id,
      title:d.title||"",
      start,end,
      allDay:!!d.allDay,
      owner:normalizeOwner(d.owner),
      ownerCustom:d.ownerCustom||"",
      type:d.type||"general",
      notes:d.notes||"",
      checklist:Array.isArray(d.checklist)?d.checklist:[],
      repeat:d.repeat||"none",
      repeatUntil:d.repeatUntil||""
    };
  }).filter(d=>d.start instanceof Date&&!isNaN(d.start));
}

function expandRepeats(norm){
  const horizonDays=240;
  const now=new Date();
  const horizon=new Date(now.getTime()+horizonDays*86400000);

  const out=[];
  for(const d of norm){
    const repeat=d.repeat||"none";
    if(repeat==="none"){
      out.push(makeFcEvent(d,d.start,d.end,false));
      continue;
    }
    const until=d.repeatUntil?new Date(d.repeatUntil+"T23:59:59"):horizon;
    let cur=new Date(d.start);
    let count=0;
    while(cur<=until&&cur<=horizon&&count<400){
      const dur=d.end?(new Date(d.end)-new Date(d.start)):0;
      const occEnd=d.end?new Date(cur.getTime()+dur):null;
      out.push(makeFcEvent(d,cur,occEnd,true));
      cur=advanceRepeat(cur,repeat);
      count++;
    }
  }
  return out;
}

function advanceRepeat(date,repeat){
  const d=new Date(date);
  if(repeat==="daily") d.setDate(d.getDate()+1);
  else if(repeat==="weekly") d.setDate(d.getDate()+7);
  else if(repeat==="monthly") d.setMonth(d.getMonth()+1);
  else if(repeat==="yearly") d.setFullYear(d.getFullYear()+1);
  else d.setDate(d.getDate()+1);
  return d;
}

function makeFcEvent(d,start,end,isRepeat){
  return {
    id:isRepeat?`${d.id}__${start.toISOString().slice(0,10)}`:d.id,
    title:d.title,
    start:start.toISOString(),
    end:end?end.toISOString():undefined,
    allDay:d.allDay,
    extendedProps:{
      sourceId:d.id,
      owner:d.owner,
      ownerCustom:d.ownerCustom,
      type:d.type,
      notes:d.notes,
      checklist:d.checklist,
      isRepeatOccurrence:isRepeat
    }
  };
}

// ---------- Panel card rendering ----------
function renderPanelCardHTML(e){
  const p=e.extendedProps||{};
  const ownerLabel=p.owner==="custom"?(p.ownerCustom||"Other"):p.owner;
  return `
    <div class="panel-card" data-open-id="${p.sourceId||e.id}" data-occ="${String(e.start)}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span class="owner-pill">${escapeHtml(ownerLabel)}</span>
        <strong style="font-size:16px;">${escapeHtml(e.title||"")}</strong>
      </div>
      <div class="tiny muted">${escapeHtml(formatWhenForPanel({start:new Date(e.start),end:e.end?new Date(e.end):null,allDay:!!e.allDay}))}</div>
    </div>`;
}

function renderPanelCardHTMLWithProgress(e){
  const p=e.extendedProps||{};
  const items=Array.isArray(p.checklist)?p.checklist:[];
  const done=items.filter(i=>i.done).length;
  const total=items.length;
  const pct=total?Math.round((done/total)*100):0;
  const ownerLabel=p.owner==="custom"?(p.ownerCustom||"Other"):p.owner;

  return `
    <div class="panel-card" data-open-id="${p.sourceId||e.id}" data-occ="${String(e.start)}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span class="owner-pill">${escapeHtml(ownerLabel)}</span>
        <strong style="font-size:16px;margin-right:auto;">${escapeHtml(e.title||"")}</strong>
        <span class="progress-pill">${done}/${total} (${pct}%)</span>
      </div>
      <div class="tiny muted">${escapeHtml(formatWhenForPanel({start:new Date(e.start),end:e.end?new Date(e.end):null,allDay:!!e.allDay}))}</div>
    </div>`;
}

function formatWhenForPanel({start,end,allDay}){
  if(!start)return"";
  const optsDate={weekday:"short",month:"short",day:"numeric"};
  const optsTime={hour:"numeric",minute:"2-digit"};
  if(allDay)return `${start.toLocaleDateString(undefined,optsDate)} (all day)`;
  const d=start.toLocaleDateString(undefined,optsDate);
  const t1=start.toLocaleTimeString(undefined,optsTime);
  if(!end)return`${d} • ${t1}`;
  const t2=end.toLocaleTimeString(undefined,optsTime);
  return`${d} • ${t1}–${t2}`;
}

// ---------- Date helpers ----------
function toInputValue(dateObj,allDay){
  let d=dateObj instanceof Date?dateObj:new Date(dateObj);
  if(isNaN(d)) d=new Date();
  const pad=n=>String(n).padStart(2,"0");
  const y=d.getFullYear();
  const m=pad(d.getMonth()+1);
  const day=pad(d.getDate());
  if(allDay)return`${y}-${m}-${day}`;
  const hh=pad(d.getHours());
  const mm=pad(d.getMinutes());
  return`${y}-${m}-${day}T${hh}:${mm}`;
}

function fromInputValue(value,allDay){
  if(!value)return new Date();
  if(allDay){
    const [y,m,d]=value.split("-").map(Number);
    return new Date(y,m-1,d,0,0,0,0);
  }
  return new Date(value);
}

function roundToNextHour(d){
  const x=new Date(d);
  x.setMinutes(0,0,0);
  x.setHours(x.getHours()+1);
  return x;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---------- Start ----------
initApp().catch((err)=>{
  console.error(err);
  alert("Firebase failed to initialize.");
});