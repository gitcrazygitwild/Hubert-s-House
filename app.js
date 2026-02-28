// Mack Calendar — full features + checklist presets + checklist progress
// Gate: case-insensitive password + remember device option (localStorage)

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
const PASSWORD = "mack"; // store lowercase
const LS_UNLOCK = "mack_calendar_unlocked";

const gate = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const gateInput = document.getElementById("gateInput");
const rememberDevice = document.getElementById("rememberDevice");

function showGate() {
  gate?.classList.remove("hidden");
  // small delay helps iOS focus after overlay shows
  setTimeout(() => gateInput?.focus?.(), 50);
}

function hideGate() {
  gate?.classList.add("hidden");
}

function isRemembered() {
  return localStorage.getItem(LS_UNLOCK) === "1";
}

// On load: if remembered, skip gate
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

// ---------- Top buttons ----------
const todayBtn = document.getElementById("todayBtn");
const statusEl = document.getElementById("status");

// ---------- Modal elements ----------
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
const evtType = document.getElementById("evtType");
const evtNotes = document.getElementById("evtNotes");

const checklistEl = document.getElementById("checklist");
const addCheckItemBtn = document.getElementById("addCheckItem");

const fab = document.getElementById("fab");

backdrop?.classList.add("hidden");

// ---------- Owner colors ----------
const OWNER_STYLE = {
  his:  { backgroundColor: "rgba(122,162,255,0.35)", borderColor: "rgba(122,162,255,0.85)", textColor: "#e9ecf1" },
  hers: { backgroundColor: "rgba(255,107,107,0.28)", borderColor: "rgba(255,107,107,0.85)", textColor: "#e9ecf1" },
  both: { backgroundColor: "rgba(116,217,155,0.28)", borderColor: "rgba(116,217,155,0.85)", textColor: "#e9ecf1" }
};

// ---------- Checklist presets ----------
const CHECKLIST_PRESETS = {
  wedding: [
    "RSVP",
    "Book travel",
    "Book hotel",
    "Buy gift",
    "Outfit",
    "Transportation plan"
  ],
  trip: [
    "Book travel",
    "Book lodging",
    "Packing list",
    "House/pet plan",
    "Itinerary highlights"
  ],
  appointment: [
    "Add questions",
    "Bring documents/ID",
    "Arrive 10 min early"
  ],
  party: [
    "Confirm time/location",
    "Bring something (food/drink)",
    "Gift (if needed)",
    "Transportation plan"
  ],
  general: []
};

let currentChecklist = []; // [{text, done}]

// ---------- App state ----------
let db, eventsCol, calendar;
let editingEventId = null;

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
    const events = [];
    snap.forEach((d) => events.push({ id: d.id, ...d.data() }));

    calendar.removeAllEvents();
    for (const e of events) calendar.addEvent(normalizeEventForCalendar(e));

    statusEl.textContent = "Sync: live";
  }, (err) => {
    console.error(err);
    statusEl.textContent = "Sync: error (check rules)";
  });
}

function initCalendarUI() {
  const calendarEl = document.getElementById("calendar");

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
    },
    selectable: true,
    editable: true,
    nowIndicator: true,
    height: "auto",
    longPressDelay: 350,
    selectLongPressDelay: 350,

    dateClick: (info) => {
      const start = new Date(info.date);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      openModal({ mode: "create", title: "", start, end, allDay: false, owner: "both", type: "general", checklist: [], notes: "" });
    },

    select: (info) => openCreateModalFromSelection(info),

    eventClick: (info) => openEditModalFromEvent(info.event),

    eventDrop: async (info) => persistMovedEvent(info.event),
    eventResize: async (info) => persistMovedEvent(info.event),
  });

  calendar.render();

  todayBtn?.addEventListener("click", () => calendar.today());

  fab?.addEventListener("click", () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openModal({ mode: "create", title: "", start, end, allDay: false, owner: "both", type: "general", checklist: [], notes: "" });
  });

  modalClose?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  // All-day toggle preserves values
  evtAllDay?.addEventListener("change", () => {
    const allDay = evtAllDay.checked;
    const prevStart = evtStart.value;
    const prevEnd = evtEnd.value;

    evtStart.type = allDay ? "date" : "datetime-local";
    evtEnd.type = allDay ? "date" : "datetime-local";

    evtStart.value = convertInputValue(prevStart, allDay);
    evtEnd.value = prevEnd ? convertInputValue(prevEnd, allDay) : "";
  });

  // Type selection: apply preset (confirm if overwriting existing checklist)
  evtType?.addEventListener("change", () => {
    const nextType = evtType.value;
    if (currentChecklist.length > 0) {
      const ok = confirm("Replace your current checklist with the preset for this type?");
      if (!ok) return;
    }
    setChecklistPreset(nextType);
  });

  // Add checklist item (manual)
  addCheckItemBtn?.addEventListener("click", () => {
    currentChecklist.push({ text: "", done: false });
    renderChecklist();
  });

  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSave();
  });

  deleteBtn?.addEventListener("click", async () => {
    if (!editingEventId) return;
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", editingEventId));
    closeModal();
  });
}

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
    owner: "both",
    type: "general",
    checklist: [],
    notes: ""
  });
}

function openEditModalFromEvent(event) {
  const data = event.extendedProps || {};
  openModal({
    mode: "edit",
    id: event.id,
    title: event.titleBase || event.title || "",
    start: event.start,
    end: event.end || null,
    allDay: event.allDay,
    owner: data.owner || "both",
    type: data.type || "general",
    checklist: Array.isArray(data.checklist) ? data.checklist : [],
    notes: data.notes || ""
  });
}

function openModal(payload) {
  const isEdit = payload.mode === "edit";
  editingEventId = isEdit ? payload.id : null;

  modalTitle.textContent = isEdit ? "Edit event" : "New event";
  deleteBtn.classList.toggle("hidden", !isEdit);

  if (!isEdit && !payload.allDay && !payload.end) {
    payload.end = new Date(payload.start.getTime() + 60 * 60 * 1000);
  }

  evtTitle.value = payload.title ?? "";

  evtAllDay.checked = !!payload.allDay;
  setDateTimeInputMode(evtAllDay.checked);

  evtStart.value = toInputValue(payload.start, evtAllDay.checked);
  evtEnd.value = payload.end ? toInputValue(payload.end, evtAllDay.checked) : "";

  evtOwner.value = payload.owner || "both";
  evtType.value = payload.type || "general";
  evtNotes.value = payload.notes || "";

  currentChecklist = Array.isArray(payload.checklist) ? payload.checklist : [];

  // If creating and checklist empty and type has preset, prefill
  if (!isEdit && currentChecklist.length === 0 && evtType.value !== "general") {
    setChecklistPreset(evtType.value);
  } else {
    renderChecklist();
  }

  backdrop.classList.remove("hidden");
  evtTitle.focus();
}

function closeModal() {
  editingEventId = null;
  currentChecklist = [];
  backdrop.classList.add("hidden");
}

function setDateTimeInputMode(isAllDay) {
  evtStart.type = isAllDay ? "date" : "datetime-local";
  evtEnd.type = isAllDay ? "date" : "datetime-local";
}

function convertInputValue(value, allDay) {
  if (!value) return "";
  if (allDay) return value.includes("T") ? value.split("T")[0] : value;
  if (!value.includes("T")) return `${value}T09:00`;
  return value;
}

// ---------- Checklist UI ----------
function setChecklistPreset(type) {
  const preset = CHECKLIST_PRESETS[type] || [];
  currentChecklist = preset.map((t) => ({ text: t, done: false }));
  renderChecklist();
}

function renderChecklist() {
  // Null-safe: if HTML didn't update for some reason, don't crash the whole app
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

// ---------- Save / Update ----------
async function handleSave() {
  const title = evtTitle.value.trim();
  if (!title) return;

  const allDay = evtAllDay.checked;
  const owner = evtOwner.value;
  const type = evtType.value;
  const notes = evtNotes.value.trim();

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
    owner,
    type,
    checklist,
    notes,
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

// ---------- Checklist progress + event normalization ----------
function checklistProgress(checklist) {
  if (!Array.isArray(checklist) || checklist.length === 0) return null;
  const total = checklist.length;
  let done = 0;
  for (const item of checklist) if (item && item.done) done++;
  return { done, total };
}

function normalizeEventForCalendar(e) {
  const style = OWNER_STYLE[e.owner] || OWNER_STYLE.both;
  const checklist = Array.isArray(e.checklist) ? e.checklist : [];
  const prog = checklistProgress(checklist);

  const titleBase = e.title || "";
  const titleWithProgress = prog ? `${titleBase} (${prog.done}/${prog.total})` : titleBase;

  return {
    id: e.id,
    title: titleWithProgress,
    start: e.start,
    end: e.end || undefined,
    allDay: !!e.allDay,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: style.textColor,
    extendedProps: {
      owner: e.owner || "both",
      type: e.type || "general",
      notes: e.notes || "",
      checklist
    },
    // Keep base title for editing so we don't double-append progress
    titleBase
  };
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