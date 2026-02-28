// app.js
// Hubert’s House — Firebase shared calendar
// Features: gate (remember device, case-insensitive password), mobile modal event editor,
// owners (hanry/Karena/Both/Other), checklist presets + progress, recurrence, swipe nav,
// tap month title to jump (jump modal w/ year dropdown), owner dropdown filter,
// search (auto list view, 5-year list duration, optional date-range filter), upcoming panel.

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

// ---------- Gate ----------
const PASSWORD = "mack"; // case-insensitive
const LS_UNLOCK = "huberts_house_unlocked";

const gate = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const gateInput = document.getElementById("gateInput");
const rememberDevice = document.getElementById("rememberDevice");

function showGate() {
  gate?.classList.remove("hidden");
  setTimeout(() => gateInput?.focus?.(), 50);
}
function hideGate() {
  gate?.classList.add("hidden");
}
function isRemembered() {
  return localStorage.getItem(LS_UNLOCK) === "1";
}
if (isRemembered()) hideGate();
else showGate();

gateForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = (gateInput.value || "").trim().toLowerCase();
  if (pw === PASSWORD) {
    if (rememberDevice?.checked) localStorage.setItem(LS_UNLOCK, "1");
    else localStorage.removeItem(LS_UNLOCK);
    gateInput.value = "";
    hideGate();
  } else {
    gateInput.value = "";
    gateInput.focus();
    alert("Wrong password.");
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem(LS_UNLOCK);
  showGate();
});

// ---------- Top controls ----------
const todayBtn = document.getElementById("todayBtn");
const statusEl = document.getElementById("status");

const ownerFilter = document.getElementById("ownerFilter");

const searchInput = document.getElementById("searchInput");
const searchFrom = document.getElementById("searchFrom");
const searchTo = document.getElementById("searchTo");

// Upcoming panel
const upcomingList = document.getElementById("upcomingList");

// ---------- Modal elements (event editor) ----------
const backdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const cancelBtn = document.getElementById("cancelBtn");
const deleteBtn = document.getElementById("deleteBtn");
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
const evtNotes = document.getElementById("evtNotes");

const evtRepeat = document.getElementById("evtRepeat");
const repeatUntilWrap = document.getElementById("repeatUntilWrap");
const evtRepeatUntil = document.getElementById("evtRepeatUntil");

const checklistEl = document.getElementById("checklist");
const addCheckItemBtn = document.getElementById("addCheckItem");

const fab = document.getElementById("fab");

// ---------- Jump-to-month modal ----------
const jumpBackdrop = document.getElementById("jumpBackdrop");
const jumpClose = document.getElementById("jumpClose");
const jumpCancel = document.getElementById("jumpCancel");
const jumpGoBtn = document.getElementById("jumpGoBtn");
const jumpMonthSelect = document.getElementById("jumpMonthSelect");
const jumpYearSelect = document.getElementById("jumpYearSelect");

// ---------- Owner colors ----------
const OWNER_STYLE = {
  hanry:  { backgroundColor: "rgba(122,162,255,0.35)", borderColor: "rgba(122,162,255,0.85)", textColor: "#e9ecf1" },
  karena: { backgroundColor: "rgba(255,107,107,0.28)", borderColor: "rgba(255,107,107,0.85)", textColor: "#e9ecf1" },
  both:   { backgroundColor: "rgba(116,217,155,0.28)", borderColor: "rgba(116,217,155,0.85)", textColor: "#e9ecf1" },
  custom: { backgroundColor: "rgba(186,140,255,0.25)", borderColor: "rgba(186,140,255,0.75)", textColor: "#e9ecf1" }
};

function mapLegacyOwner(owner) {
  if (!owner) return null;
  if (owner === "his") return "hanry";
  if (owner === "hers") return "karena";
  if (owner === "both") return "both";
  return null;
}

// ---------- Checklist presets ----------
const CHECKLIST_PRESETS = {
  wedding: ["RSVP","Book travel","Book hotel","Buy gift","Outfit","Transportation plan"],
  trip: ["Book travel","Book lodging","Packing list","House/pet plan","Itinerary highlights"],
  appointment: ["Add questions","Bring documents/ID","Arrive 10 min early"],
  party: ["Confirm time/location","Bring something (food/drink)","Gift (if needed)","Transportation plan"],
  general: []
};

// ---------- App state ----------
let db, eventsCol, calendar;
let editingEventId = null;
let rawEvents = [];
let currentRange = null; // {start,end}
let currentChecklist = []; // [{text,done}]

// Filters/search state
let ownerFilterValue = "all";
let searchQuery = "";
let searchFromValue = "";
let searchToValue = "";
let preSearchView = null;
let preSearchDate = null;

// ---------- Init ----------
initApp().catch((err) => {
  console.error(err);
  statusEl.textContent = "Sync: error";
  alert("Firebase failed to initialize. Check firebaseConfig + Firestore rules.");
});

async function initApp() {
  statusEl.textContent = "Sync: connecting…";

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  eventsCol = collection(db, "events");

  initCalendarUI();

  const q = query(eventsCol, orderBy("start", "asc"));
  onSnapshot(q, (snap) => {
    rawEvents = [];
    snap.forEach((d) => rawEvents.push({ id: d.id, ...d.data() }));
    rebuildCalendarEvents();
    renderUpcoming();
    statusEl.textContent = "Sync: live";
  }, (err) => {
    console.error(err);
    statusEl.textContent = "Sync: error (check rules)";
  });
}

// ---------- Calendar UI ----------
function initCalendarUI() {
  const calendarEl = document.getElementById("calendar");
  const wrap = document.getElementById("calendarWrap");

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
initialDate: new Date(),
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek,listYear"
    },
    views: {
      // Search mode uses listYear; make it feel “all time-ish”
      listYear: { duration: { years: 5 } }
    },

    selectable: true,
    editable: true,
    nowIndicator: true,
    height: "auto",
    longPressDelay: 350,
    selectLongPressDelay: 350,

    datesSet: (info) => {
      currentRange = { start: info.start, end: info.end };
      rebuildCalendarEvents();
      bindMonthTitleClick();
    },

    dateClick: (info) => {
      const start = new Date(info.date);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      openModal({
        mode: "create",
        title: "",
        start,
        end,
        allDay: false,
        ownerKey: "both",
        ownerLabel: "Both",
        type: "general",
        checklist: [],
        notes: "",
        recurrence: { freq: "none", until: null }
      });
    },

    select: (info) => openCreateModalFromSelection(info),
    eventClick: (info) => openEditModalFromEvent(info.event),

    eventDrop: async (info) => {
      if (info.event.extendedProps?.isRecurringInstance) {
        alert("Move the series by editing the repeating event (single-instance moves not supported yet).");
        info.revert();
        return;
      }
      await persistMovedEvent(info.event);
    },
    eventResize: async (info) => {
      if (info.event.extendedProps?.isRecurringInstance) {
        alert("Resize the series by editing the repeating event (single-instance edits not supported yet).");
        info.revert();
        return;
      }
      await persistMovedEvent(info.event);
    },
  });

  calendar.render();
  resetSearchUIOnLoad();
calendar.changeView("dayGridMonth");
calendar.today();

  function resetSearchUIOnLoad() {
  // Clear any autofilled values so we don't enter search mode on load
  if (searchInput) searchInput.value = "";
  if (searchFrom) searchFrom.value = "";
  if (searchTo) searchTo.value = "";

  searchQuery = "";
  searchFromValue = "";
  searchToValue = "";

  preSearchView = null;
  preSearchDate = null;
}
  bindMonthTitleClick();
  attachSwipeNavigation(wrap);

  todayBtn?.addEventListener("click", () => calendar.today());

  // Owner filter dropdown
  ownerFilter?.addEventListener("change", () => {
    ownerFilterValue = ownerFilter.value || "all";
    rebuildCalendarEvents();
  });

  // Search behavior: auto list view + optional date range
  searchInput?.addEventListener("input", () => {
    searchQuery = (searchInput.value || "").trim().toLowerCase();
    enterSearchModeIfNeeded();
    rebuildCalendarEvents();
  });
  searchFrom?.addEventListener("change", () => {
    searchFromValue = (searchFrom.value || "").trim();
    enterSearchModeIfNeeded();
    rebuildCalendarEvents();
  });
  searchTo?.addEventListener("change", () => {
    searchToValue = (searchTo.value || "").trim();
    enterSearchModeIfNeeded();
    rebuildCalendarEvents();
  });

  // FAB create
  fab?.addEventListener("click", () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openModal({
      mode: "create",
      title: "",
      start,
      end,
      allDay: false,
      ownerKey: "both",
      ownerLabel: "Both",
      type: "general",
      checklist: [],
      notes: "",
      recurrence: { freq: "none", until: null }
    });
  });

  // Modal close handlers
  modalClose?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  // All-day toggle (preserves values)
  evtAllDay?.addEventListener("change", () => {
    const allDay = evtAllDay.checked;
    const prevStart = evtStart.value;
    const prevEnd = evtEnd.value;

    evtStart.type = allDay ? "date" : "datetime-local";
    evtEnd.type = allDay ? "date" : "datetime-local";

    evtStart.value = convertInputValue(prevStart, allDay);
    evtEnd.value = prevEnd ? convertInputValue(prevEnd, allDay) : "";
  });

  // Owner custom show/hide
  evtOwner?.addEventListener("change", () => {
    const isCustom = evtOwner.value === "custom";
    ownerCustomWrap?.classList.toggle("hidden", !isCustom);
    if (isCustom) setTimeout(() => evtOwnerCustom?.focus?.(), 50);
  });

  // Repeat show/hide
  evtRepeat?.addEventListener("change", () => {
    const isRepeating = evtRepeat.value !== "none";
    repeatUntilWrap?.classList.toggle("hidden", !isRepeating);
    if (!isRepeating && evtRepeatUntil) evtRepeatUntil.value = "";
  });

  // Type preset checklist
  evtType?.addEventListener("change", () => {
    const nextType = evtType.value;
    if (currentChecklist.length > 0) {
      const ok = confirm("Replace your current checklist with the preset for this type?");
      if (!ok) return;
    }
    setChecklistPreset(nextType);
  });

  addCheckItemBtn?.addEventListener("click", () => {
    currentChecklist.push({ text: "", done: false });
    renderChecklist();
  });

  // Save event
  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSave();
  });

  // Delete event
  deleteBtn?.addEventListener("click", async () => {
    if (!editingEventId) return;
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", editingEventId));
    closeModal();
  });

  // Jump modal handlers
  jumpClose?.addEventListener("click", closeJumpModal);
  jumpCancel?.addEventListener("click", closeJumpModal);
  jumpBackdrop?.addEventListener("click", (e) => {
    if (e.target === jumpBackdrop) closeJumpModal();
  });
  jumpGoBtn?.addEventListener("click", () => {
    const m = Number(jumpMonthSelect?.value ?? 0);
    const y = Number(jumpYearSelect?.value ?? new Date().getFullYear());
    calendar.gotoDate(new Date(y, m, 1));
    closeJumpModal();
  });
}

function enterSearchModeIfNeeded() {
  if (!calendar) return;
  const hasText = !!searchQuery;
  const hasRange = !!(searchFromValue || searchToValue);

  if (hasText || hasRange) {
    if (!preSearchView) {
      preSearchView = calendar.view.type;
      preSearchDate = calendar.getDate();
    }
    calendar.changeView("listYear");
  } else {
    if (preSearchView) {
      calendar.changeView(preSearchView);
      if (preSearchDate) calendar.gotoDate(preSearchDate);
    }
    preSearchView = null;
    preSearchDate = null;
  }
}

// ---------- Month-title tap to open Jump modal ----------
function bindMonthTitleClick() {
  const titleEl = document.querySelector(".fc .fc-toolbar-title");
  if (!titleEl) return;

  // avoid duplicates
  if (titleEl.dataset.boundJump === "1") return;
  titleEl.dataset.boundJump = "1";

  titleEl.style.cursor = "pointer";
  titleEl.title = "Tap to jump to a month";

  // pointerup is more reliable on iOS than click
  titleEl.addEventListener("pointerup", (e) => {
    e.preventDefault();
    openJumpModal();
  });
}

function populateYearSelect(centerYear) {
  if (!jumpYearSelect) return;
  const start = centerYear - 10;
  const end = centerYear + 10;
  jumpYearSelect.innerHTML = "";
  for (let y = start; y <= end; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    jumpYearSelect.appendChild(opt);
  }
}

function openJumpModal() {
  if (!calendar) return;
  const d = calendar.getDate();
  if (jumpMonthSelect) jumpMonthSelect.value = String(d.getMonth());
  populateYearSelect(d.getFullYear());
  if (jumpYearSelect) jumpYearSelect.value = String(d.getFullYear());
  jumpBackdrop?.classList.remove("hidden");
}

function closeJumpModal() {
  jumpBackdrop?.classList.add("hidden");
}

// ---------- Swipe navigation ----------
function attachSwipeNavigation(targetEl) {
  let sx = 0, sy = 0;
  let tracking = false;
  let locked = false;

  const MIN_X = 40;
  const MIN_LOCK = 12;
  const MAX_Y = 80;

  targetEl.addEventListener("touchstart", (e) => {
    // IMPORTANT: do not treat toolbar taps as swipes
    if (e.target && e.target.closest && e.target.closest(".fc-toolbar")) return;

    if (!e.touches || e.touches.length !== 1) return;
    tracking = true;
    locked = false;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });

  targetEl.addEventListener("touchmove", (e) => {
    if (!tracking || !e.touches || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;

    if (!locked && Math.abs(dx) > MIN_LOCK && Math.abs(dy) < MAX_Y) {
      locked = true;
    }
    if (locked) e.preventDefault();
  }, { passive: false });

  targetEl.addEventListener("touchend", (e) => {
    if (!tracking || !e.changedTouches || e.changedTouches.length !== 1) return;
    tracking = false;

    const ex = e.changedTouches[0].clientX;
    const ey = e.changedTouches[0].clientY;
    const dx = ex - sx;
    const dy = ey - sy;

    if (Math.abs(dx) >= MIN_X && Math.abs(dy) <= MAX_Y) {
      if (dx < 0) calendar.next();
      else calendar.prev();
    }
  }, { passive: true });
}

// ---------- Modal open helpers ----------
function openCreateModalFromSelection(info) {
  const start = info.start;
  let end = info.end || null;
  if (!end && !info.allDay) end = new Date(start.getTime() + 60 * 60 * 1000);

  openModal({
    mode: "create",
    title: "",
    start,
    end,
    allDay: info.allDay,
    ownerKey: "both",
    ownerLabel: "Both",
    type: "general",
    checklist: [],
    notes: "",
    recurrence: { freq: "none", until: null }
  });
}

function openEditModalFromEvent(event) {
  const data = event.extendedProps || {};
  const seriesId = data.seriesId || event.id;

  const raw = rawEvents.find((x) => x.id === seriesId);
  if (!raw) return;

  openModal({
    mode: "edit",
    id: raw.id,
    title: raw.title || "",
    start: new Date(raw.start),
    end: raw.end ? new Date(raw.end) : null,
    allDay: !!raw.allDay,
    ownerKey: raw.ownerKey || mapLegacyOwner(raw.owner) || "both",
    ownerLabel: raw.ownerLabel || "Both",
    type: raw.type || "general",
    checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
    notes: raw.notes || "",
    recurrence: normalizeRecurrence(raw.recurrence)
  });
}

function openModal(payload) {
  const isEdit = payload.mode === "edit";
  editingEventId = isEdit ? payload.id : null;

  modalTitle.textContent = isEdit ? "Edit event" : "New event";
  deleteBtn.classList.toggle("hidden", !isEdit);

  evtTitle.value = payload.title ?? "";
  evtAllDay.checked = !!payload.allDay;

  evtStart.type = evtAllDay.checked ? "date" : "datetime-local";
  evtEnd.type = evtAllDay.checked ? "date" : "datetime-local";

  evtStart.value = toInputValue(payload.start, evtAllDay.checked);
  evtEnd.value = payload.end ? toInputValue(payload.end, evtAllDay.checked) : "";

  // Owner
  evtOwner.value = payload.ownerKey || "both";
  const isCustom = evtOwner.value === "custom";
  ownerCustomWrap?.classList.toggle("hidden", !isCustom);
  if (evtOwnerCustom) evtOwnerCustom.value = isCustom ? (payload.ownerLabel || "") : "";

  // Type
  evtType.value = payload.type || "general";

  // Repeat
  const rec = normalizeRecurrence(payload.recurrence);
  evtRepeat.value = rec.freq || "none";
  repeatUntilWrap?.classList.toggle("hidden", evtRepeat.value === "none");
  evtRepeatUntil.value = rec.until ? rec.until : "";

  // Notes
  evtNotes.value = payload.notes || "";

  // Checklist
  currentChecklist = Array.isArray(payload.checklist) ? payload.checklist : [];
  if (!isEdit && currentChecklist.length === 0 && evtType.value !== "general") {
    setChecklistPreset(evtType.value);
  } else {
    renderChecklist();
  }

  backdrop.classList.remove("hidden");
  setTimeout(() => evtTitle.focus(), 50);
}

function closeModal() {
  editingEventId = null;
  currentChecklist = [];
  backdrop.classList.add("hidden");
}

// ---------- All-day conversion helper ----------
function convertInputValue(value, allDay) {
  if (!value) return "";
  if (allDay) return value.includes("T") ? value.split("T")[0] : value;
  if (!value.includes("T")) return `${value}T09:00`;
  return value;
}

// ---------- Checklist ----------
function setChecklistPreset(type) {
  const preset = CHECKLIST_PRESETS[type] || [];
  currentChecklist = preset.map((t) => ({ text: t, done: false }));
  renderChecklist();
}

function renderChecklist() {
  if (!checklistEl) return;
  checklistEl.innerHTML = "";

  if (!currentChecklist.length) {
    const empty = document.createElement("div");
    empty.className = "tiny muted";
    empty.textContent = "No items yet.";
    checklistEl.appendChild(empty);
    return;
  }

  currentChecklist.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "check-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!item.done;
    cb.addEventListener("change", () => {
      currentChecklist[idx].done = cb.checked;
    });

    const text = document.createElement("input");
    text.type = "text";
    text.value = item.text || "";
    text.placeholder = "Checklist item…";
    text.addEventListener("input", () => {
      currentChecklist[idx].text = text.value;
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-ghost remove";
    remove.textContent = "✕";
    remove.addEventListener("click", () => {
      currentChecklist.splice(idx, 1);
      renderChecklist();
    });

    row.appendChild(cb);
    row.appendChild(text);
    row.appendChild(remove);
    checklistEl.appendChild(row);
  });
}

// ---------- Recurrence ----------
function normalizeRecurrence(r) {
  const freq = r?.freq || "none";
  const until = r?.until || null; // YYYY-MM-DD
  return { freq, until };
}

function buildRecurrenceFromForm() {
  const freq = evtRepeat?.value || "none";
  if (freq === "none") return { freq: "none", until: null };
  const until = (evtRepeatUntil?.value || "").trim();
  return { freq, until: until || null };
}

function addInterval(date, freq) {
  const d = new Date(date);
  if (freq === "daily") d.setDate(d.getDate() + 1);
  else if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d;
}

function expandRecurringEvent(base, rangeStart, rangeEnd) {
  const rec = normalizeRecurrence(base.recurrence);
  if (rec.freq === "none") return [];

  const baseStart = new Date(base.start);
  const baseEnd = base.end ? new Date(base.end) : null;
  const durationMs = baseEnd ? (baseEnd.getTime() - baseStart.getTime()) : 0;

  const untilDate = rec.until ? new Date(rec.until + "T23:59:59") : null;

  const out = [];
  let cur = new Date(baseStart);

  // advance until rangeStart
  let guard = 0;
  while (cur < rangeStart && guard < 5000) {
    cur = addInterval(cur, rec.freq);
    guard++;
    if (untilDate && cur > untilDate) return out;
  }

  // generate in range
  guard = 0;
  while (cur < rangeEnd && guard < 5000) {
    if (!untilDate || cur <= untilDate) {
      const occStart = new Date(cur);
      const occEnd = baseEnd ? new Date(occStart.getTime() + durationMs) : null;
      out.push({ _occStart: occStart, _occEnd: occEnd, _seriesId: base.id });
    } else break;

    cur = addInterval(cur, rec.freq);
    guard++;
  }

  return out;
}

// ---------- Save / Update ----------
function ownerFromInputs() {
  const ownerKey = evtOwner.value || "both";
  if (ownerKey === "custom") {
    const label = (evtOwnerCustom?.value || "").trim();
    return { ownerKey: "custom", ownerLabel: label || "Other" };
  }
  if (ownerKey === "hanry") return { ownerKey: "hanry", ownerLabel: "hanry" };
  if (ownerKey === "karena") return { ownerKey: "karena", ownerLabel: "Karena" };
  return { ownerKey: "both", ownerLabel: "Both" };
}

async function handleSave() {
  const title = evtTitle.value.trim();
  if (!title) return;

  const allDay = evtAllDay.checked;
  const { ownerKey, ownerLabel } = ownerFromInputs();

  if (ownerKey === "custom" && (!ownerLabel || ownerLabel === "Other")) {
    alert("Please type a name for 'Other…'.");
    evtOwnerCustom?.focus?.();
    return;
  }

  const type = evtType.value;
  const notes = evtNotes.value.trim();
  const recurrence = buildRecurrenceFromForm();

  const start = fromInputValue(evtStart.value, allDay);
  const end = evtEnd.value ? fromInputValue(evtEnd.value, allDay) : null;

  if (end && end.getTime() < start.getTime()) {
    alert("End must be after start.");
    return;
  }

  const checklist = (currentChecklist || [])
    .map((x) => ({ text: (x.text || "").trim(), done: !!x.done }))
    .filter((x) => x.text.length);

  const payload = {
    title,
    allDay,
    ownerKey,
    ownerLabel,
    type,
    checklist,
    notes,
    recurrence,
    start: start.toISOString(),
    end: end ? end.toISOString() : null,
    updatedAt: serverTimestamp()
  };

  if (editingEventId) {
    await updateDoc(doc(db, "events", editingEventId), payload);
  } else {
    await addDoc(eventsCol, { ...payload, createdAt: serverTimestamp() });
  }

  closeModal();
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

// ---------- Filters + search ----------
function passesOwnerFilter(ownerKey) {
  if (ownerFilterValue === "all") return true;
  return (ownerKey || "both") === ownerFilterValue;
}

function passesSearchFilter(e) {
  const hasText = !!searchQuery;
  const hasRange = !!(searchFromValue || searchToValue);
  if (!hasText && !hasRange) return true;

  if (hasText) {
    const t = (e.title || "").toLowerCase();
    const n = (e.notes || "").toLowerCase();
    if (!(t.includes(searchQuery) || n.includes(searchQuery))) return false;
  }

  if (hasRange) {
    const start = new Date(e.start);
    const startDay = start.toISOString().slice(0, 10);
    if (searchFromValue && startDay < searchFromValue) return false;
    if (searchToValue && startDay > searchToValue) return false;
  }

  return true;
}

// ---------- Calendar rebuild ----------
function checklistProgress(checklist) {
  if (!Array.isArray(checklist) || checklist.length === 0) return null;
  const total = checklist.length;
  let done = 0;
  for (const item of checklist) if (item && item.done) done++;
  return { done, total };
}

function normalizeEventForCalendar(e, overrides = {}) {
  const ownerKey = (e.ownerKey || mapLegacyOwner(e.owner) || "both");
  const style = OWNER_STYLE[ownerKey] || OWNER_STYLE.both;

  const checklist = Array.isArray(e.checklist) ? e.checklist : [];
  const prog = checklistProgress(checklist);

  const titleBase = e.title || "";
  const titleWithProgress = prog ? `${titleBase} (${prog.done}/${prog.total})` : titleBase;

  return {
    id: overrides.id || e.id,
    title: titleWithProgress,
    start: overrides.start || e.start,
    end: overrides.end || (e.end || undefined),
    allDay: !!e.allDay,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: style.textColor,
    editable: !overrides.isRecurringInstance,
    extendedProps: {
      ownerKey,
      ownerLabel: e.ownerLabel || (ownerKey === "karena" ? "Karena" : ownerKey === "hanry" ? "hanry" : ownerKey === "custom" ? "Other" : "Both"),
      type: e.type || "general",
      notes: e.notes || "",
      checklist,
      isRecurringInstance: !!overrides.isRecurringInstance,
      seriesId: overrides.seriesId || null
    }
  };
}

function rebuildCalendarEvents() {
  if (!calendar) return;

  const rs = currentRange?.start ? new Date(currentRange.start) : null;
  const re = currentRange?.end ? new Date(currentRange.end) : null;

  calendar.removeAllEvents();

  for (const e of rawEvents) {
    const ownerKey = e.ownerKey || mapLegacyOwner(e.owner) || "both";
    if (!passesOwnerFilter(ownerKey)) continue;
    if (!passesSearchFilter(e)) continue;

    const rec = normalizeRecurrence(e.recurrence);

    if (rec.freq !== "none" && rs && re) {
      const occs = expandRecurringEvent({ ...e, id: e.id }, rs, re);
      for (const occ of occs) {
        const occId = `${occ._seriesId}__${occ._occStart.toISOString()}`;
        const startISO = occ._occStart.toISOString();
        const endISO = occ._occEnd ? occ._occEnd.toISOString() : undefined;

        calendar.addEvent(normalizeEventForCalendar(e, {
          id: occId,
          start: startISO,
          end: endISO,
          isRecurringInstance: true,
          seriesId: occ._seriesId
        }));
      }
    } else {
      calendar.addEvent(normalizeEventForCalendar(e));
    }
  }
}

// ---------- Upcoming panel ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

function renderUpcoming() {
  if (!upcomingList) return;

  const now = new Date();
  const items = rawEvents
    .filter(e => e.start && new Date(e.start) >= now)
    .sort((a,b) => new Date(a.start) - new Date(b.start))
    .slice(0, 5);

  if (!items.length) {
    upcomingList.textContent = "No upcoming events.";
    return;
  }

  upcomingList.innerHTML = "";
  for (const e of items) {
    const d = new Date(e.start);
    const label = d.toLocaleString([], { weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });

    const row = document.createElement("div");
    row.className = "upcoming-item";
    row.innerHTML = `<strong>${escapeHtml(e.title || "(untitled)")}</strong><span>${escapeHtml(label)}</span>`;
    upcomingList.appendChild(row);
  }
}

// ---------- Date helpers ----------
function toInputValue(dateObj, allDay) {
  if (!(dateObj instanceof Date)) dateObj = new Date(dateObj);
  const pad = (n) => String(n).padStart(2, "0");
  const y = dateObj.getFullYear();
  const m = pad(dateObj.getMonth() + 1);
  const d = pad(dateObj.getDate());
  if (allDay) return `${y}-${m}-${d}`;
  const hh = pad(dateObj.getHours());
  const mm = pad(dateObj.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function fromInputValue(value, allDay) {
  if (allDay) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(value);
}