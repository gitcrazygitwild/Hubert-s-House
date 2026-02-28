// Mack Calendar — Firebase sync + mobile-friendly + time + notes + his/hers/both
// Gate is client-side only (not real security).

// ---------- Gate ----------
const PASSWORD = "Mack";

// IMPORTANT: to require password EVERY time, we do NOT auto-read localStorage.
// If you want "remember on this device", I can re-enable it cleanly.
const LS_UNLOCK = "mack_calendar_unlocked";

const gate = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const gateInput = document.getElementById("gateInput");

const mainEl = document.getElementById("main");
mainEl?.classList.remove("hidden"); // ensure main is visible

function unlock() {
  // optional: keep this line if you want “remember me” behavior later
  // localStorage.setItem(LS_UNLOCK, "1");
  gate.classList.add("hidden");
}

function lock() {
  localStorage.removeItem(LS_UNLOCK);
  gate.classList.remove("hidden");
  gateInput?.focus?.();
}

gateForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = (gateInput.value || "").trim();
  if (pw === PASSWORD) {
    unlock();
    gateInput.value = "";
  } else {
    gateInput.value = "";
    gateInput.focus();
    alert("Wrong password.");
  }
});

// ALWAYS show gate on load (no auto-unlock)
gate?.classList.remove("hidden");

// ---------- Topbar buttons ----------
const logoutBtn = document.getElementById("logoutBtn");
const todayBtn = document.getElementById("todayBtn");
const statusEl = document.getElementById("status");

logoutBtn?.addEventListener("click", () => lock());
todayBtn?.addEventListener("click", () => calendar?.today());

// ---------- Modal elements ----------
const backdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const eventForm = document.getElementById("eventForm");
const modalTitle = document.getElementById("modalTitle");

const evtTitle = document.getElementById("evtTitle");
const evtStart = document.getElementById("evtStart");
const evtEnd = document.getElementById("evtEnd");
const evtAllDay = document.getElementById("evtAllDay");
const evtOwner = document.getElementById("evtOwner");
const evtNotes = document.getElementById("evtNotes");

const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");
const fab = document.getElementById("fab");

// Force modal to be hidden on load (prevents “inline editor” feeling if HTML/CSS is off)
backdrop?.classList.add("hidden");

// ---------- Colors ----------
const OWNER_STYLE = {
  his:  { backgroundColor: "rgba(122,162,255,0.35)", borderColor: "rgba(122,162,255,0.85)" },
  hers: { backgroundColor: "rgba(255,107,107,0.28)", borderColor: "rgba(255,107,107,0.85)" },
  both: { backgroundColor: "rgba(116,217,155,0.28)", borderColor: "rgba(116,217,155,0.85)" }
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
let editingEventId = null;

// ---------- App init ----------
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

// ---------- Calendar UI ----------
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
      openModal({ mode: "create", title: "", start, end, allDay: false, owner: "both", notes: "" });
    },

    select: (info) => openCreateModalFromSelection(info),
    eventClick: (info) => openEditModalFromEvent(info.event),

    eventDrop: async (info) => persistMovedEvent(info.event),
    eventResize: async (info) => persistMovedEvent(info.event),
  });

  calendar.render();

  fab?.addEventListener("click", () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openModal({ mode: "create", title: "", start, end, allDay: false, owner: "both", notes: "" });
  });

  modalClose?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  // FIX: all-day should NOT clear the date
  evtAllDay?.addEventListener("change", () => {
    const allDay = evtAllDay.checked;

    const prevStart = evtStart.value;
    const prevEnd = evtEnd.value;

    evtStart.type = allDay ? "date" : "datetime-local";
    evtEnd.type = allDay ? "date" : "datetime-local";

    evtStart.value = convertInputValue(prevStart, allDay);
    evtEnd.value = prevEnd ? convertInputValue(prevEnd, allDay) : "";
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

  evtTitle.value = payload.title ?? "";

  // Set checkbox first, then types, then values
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
  // date -> datetime-local
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
  const notes = e.notes || "";

  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end || undefined,
    allDay: !!e.allDay,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: "#111",
    extendedProps: { owner: e.owner || "both", notes }
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

// Start immediately (calendar renders, gate covers it until unlock)
initApp().catch((err) => {
  console.error(err);
  statusEl.textContent = "Sync: error";
  alert("Firebase failed to initialize. Check firebaseConfig + Firestore rules.");
});