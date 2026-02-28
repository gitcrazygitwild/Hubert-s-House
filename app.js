// Mack Calendar — FULL FEATURE VERSION
// Firebase sync + mobile-friendly modal + notes + his/hers/both colors
// Password gate required EVERY visit (no remember; not real security)

// ---------- Firebase (CDN module imports) ----------
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

// ---------- Gate (required every visit) ----------
const PASSWORD = "Mack";
const gate = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const gateInput = document.getElementById("gateInput");

// show gate by default (HTML should be <div id="gate" class="gate">)
gate?.classList.remove("hidden");

gateForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = (gateInput.value || "").trim();
  if (pw === PASSWORD) {
    gate.classList.add("hidden");
    gateInput.value = "";
  } else {
    gateInput.value = "";
    gateInput.focus();
    alert("Wrong password.");
  }
});

// Lock button re-opens gate (does NOT remember session)
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  gate.classList.remove("hidden");
  gateInput?.focus?.();
});

// ---------- UI elements ----------
const todayBtn = document.getElementById("todayBtn");
const statusEl = document.getElementById("status");
const fab = document.getElementById("fab");

// Modal elements
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
const evtNotes = document.getElementById("evtNotes");

// Ensure modal is hidden initially
backdrop?.classList.add("hidden");

// ---------- Owner colors ----------
const OWNER_STYLE = {
  his:  { backgroundColor: "rgba(122,162,255,0.35)", borderColor: "rgba(122,162,255,0.85)", textColor: "#e9ecf1" },
  hers: { backgroundColor: "rgba(255,107,107,0.28)", borderColor: "rgba(255,107,107,0.85)", textColor: "#e9ecf1" },
  both: { backgroundColor: "rgba(116,217,155,0.28)", borderColor: "rgba(116,217,155,0.85)", textColor: "#e9ecf1" }
};

// ---------- App state ----------
let db, eventsCol;
let calendar;
let editingEventId = null;

// ---------- Init Firebase + Calendar ----------
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
    for (const e of events) {
      calendar.addEvent(normalizeEventForCalendar(e));
    }

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

    // Tap a day to create event @ 9am (month view feels like Google Calendar)
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
        owner: "both",
        notes: ""
      });
    },

    // Drag-select to create (works best in week/day views)
    select: (info) => openCreateModalFromSelection(info),

    // Tap event to edit
    eventClick: (info) => openEditModalFromEvent(info.event),

    // Persist move/resize
    eventDrop: async (info) => persistMovedEvent(info.event),
    eventResize: async (info) => persistMovedEvent(info.event),
  });

  calendar.render();

  todayBtn?.addEventListener("click", () => calendar.today());

  fab?.addEventListener("click", () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openModal({ mode: "create", title: "", start, end, allDay: false, owner: "both", notes: "" });
  });

  // Modal close handlers
  modalClose?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  // All-day toggle that preserves date value
  evtAllDay?.addEventListener("change", () => {
    const allDay = evtAllDay.checked;

    const prevStart = evtStart.value;
    const prevEnd = evtEnd.value;

    evtStart.type = allDay ? "date" : "datetime-local";
    evtEnd.type = allDay ? "date" : "datetime-local";

    evtStart.value = convertInputValue(prevStart, allDay);
    evtEnd.value = prevEnd ? convertInputValue(prevEnd, allDay) : "";
  });

  // Save
  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSave();
  });

  // Delete
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

  // Default +1h if end not provided and not all-day
  if (!end && !info.allDay) end = new Date(start.getTime() + 60 * 60 * 1000);

  openModal({
    mode: "create",
    title: "",
    start,
    end,
    allDay: info.allDay,
    owner: "both",
    notes: ""
  });
}

function openEditModalFromEvent(event) {
  const data = event.extendedProps || {};
  openModal({
    mode: "edit",
    id: event.id,
    title: event.title || "",
    start: event.start,
    end: event.end || null,
    allDay: event.allDay,
    owner: data.owner || "both",
    notes: data.notes || ""
  });
}

function openModal(payload) {
  const isEdit = payload.mode === "edit";
  editingEventId = isEdit ? payload.id : null;

  modalTitle.textContent = isEdit ? "Edit event" : "New event";
  deleteBtn.classList.toggle("hidden", !isEdit);

  // Default end time if creating a timed event with no end
  if (!isEdit && !payload.allDay && !payload.end) {
    payload.end = new Date(payload.start.getTime() + 60 * 60 * 1000);
  }

  evtTitle.value = payload.title ?? "";

  evtAllDay.checked = !!payload.allDay;
  setDateTimeInputMode(evtAllDay.checked);

  evtStart.value = toInputValue(payload.start, evtAllDay.checked);
  evtEnd.value = payload.end ? toInputValue(payload.end, evtAllDay.checked) : "";

  evtOwner.value = payload.owner || "both";
  evtNotes.value = payload.notes || "";

  backdrop.classList.remove("hidden");
  evtTitle.focus();
}

function closeModal() {
  editingEventId = null;
  backdrop.classList.add("hidden");
}

function setDateTimeInputMode(isAllDay) {
  evtStart.type = isAllDay ? "date" : "datetime-local";
  evtEnd.type = isAllDay ? "date" : "datetime-local";
}

function convertInputValue(value, allDay) {
  if (!value) return "";
  if (allDay) {
    // datetime-local -> date
    return value.includes("T") ? value.split("T")[0] : value;
  }
  // date -> datetime-local (default 9am)
  if (!value.includes("T")) return `${value}T09:00`;
  return value;
}

async function handleSave() {
  const title = evtTitle.value.trim();
  if (!title) return;

  const allDay = evtAllDay.checked;
  const owner = evtOwner.value;
  const notes = evtNotes.value.trim();

  const start = fromInputValue(evtStart.value, allDay);
  const end = evtEnd.value ? fromInputValue(evtEnd.value, allDay) : null;

  if (end && end.getTime() < start.getTime()) {
    alert("End must be after start.");
    return;
  }

  const payload = {
    title,
    allDay,
    owner,
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

function normalizeEventForCalendar(e) {
  const style = OWNER_STYLE[e.owner] || OWNER_STYLE.both;
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end || undefined,
    allDay: !!e.allDay,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: style.textColor,
    extendedProps: {
      owner: e.owner || "both",
      notes: e.notes || ""
    }
  };
}

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