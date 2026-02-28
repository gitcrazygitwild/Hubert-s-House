// Mack Calendar (Firebase sync + mobile-friendly + time + notes + his/hers/both)
// Password gate is client-side only (not real security).

// ---------- Password gate ----------
const PASSWORD = "Mack";
const LS_UNLOCK = "mack_calendar_unlocked";

const loginEl = document.getElementById("login");
const mainEl = document.getElementById("main");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const logoutBtn = document.getElementById("logoutBtn");
const todayBtn = document.getElementById("todayBtn");
const statusEl = document.getElementById("status");

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

// ---------- Color mapping ----------
const OWNER_STYLE = {
  his:  { backgroundColor: "rgba(122,162,255,0.35)", borderColor: "rgba(122,162,255,0.85)" },
  hers: { backgroundColor: "rgba(255,107,107,0.28)", borderColor: "rgba(255,107,107,0.85)" },
  both: { backgroundColor: "rgba(116,217,155,0.28)", borderColor: "rgba(116,217,155,0.85)" }
};

// ---------- Firebase (required) ----------
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

// Paste your Firebase config here:
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBEXNyX6vIbHwGCpI3fpVUb5llubOjt9qQ",
  authDomain: "huberts-house.firebaseapp.com",
  projectId: "huberts-house",
  storageBucket: "huberts-house.firebasestorage.app",
  messagingSenderId: "233498547172",
  appId: "1:233498547172:web:e250d2f14b0e19c6322df1",
  measurementId: "G-CX5MN6WBFP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

let db, eventsCol;

// ---------- Calendar ----------
let calendar;

// For modal context (create/edit)
let editingEventId = null;

// Auto-unlock if previously unlocked on this device
if (localStorage.getItem(LS_UNLOCK) === "1") {
  showMain();
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = passwordInput.value.trim();
  if (pw === PASSWORD) {
    localStorage.setItem(LS_UNLOCK, "1");
    showMain();
  } else {
    passwordInput.value = "";
    passwordInput.focus();
    alert("Wrong password.");
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(LS_UNLOCK);
  location.reload();
});

todayBtn.addEventListener("click", () => {
  if (calendar) calendar.today();
});

function showMain() {
  loginEl.classList.add("hidden");
  mainEl.classList.remove("hidden");
  initApp().catch((err) => {
    console.error(err);
    statusEl.textContent = "Error";
    alert("Firebase connection failed. Check firebaseConfig in app.js.");
  });
}

// ---------- Firebase init + realtime sync ----------
async function initApp() {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  eventsCol = collection(db, "events");

  statusEl.textContent = "Sync: connecting…";

  initCalendarUI();

  // Realtime listener
  const q = query(eventsCol, orderBy("start", "asc"));
  onSnapshot(q, (snap) => {
    const events = [];
    snap.forEach((d) => events.push({ id: d.id, ...d.data() }));

    // Replace all events (simple + reliable for shared sync)
    calendar.removeAllEvents();
    for (const e of events) {
      calendar.addEvent(normalizeEventForCalendar(e));
    }

    statusEl.textContent = "Sync: live";
  }, (err) => {
    console.error(err);
    statusEl.textContent = "Sync: error";
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

    // Create event by selecting a range
    select: (info) => {
      openCreateModalFromSelection(info);
    },

    // Click to edit + show notes in description area (we also show via modal)
    eventClick: (info) => {
      openEditModalFromEvent(info.event);
    },

    // Drag / resize persists to Firestore
    eventDrop: async (info) => {
      await persistMovedEvent(info.event);
    },
    eventResize: async (info) => {
      await persistMovedEvent(info.event);
    },

    // Helpful on mobile: long-press to select
    longPressDelay: 350,
    selectLongPressDelay: 350
  });

  calendar.render();

  // Floating Add button (mobile-friendly)
  fab.addEventListener("click", () => {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    openModal({
      mode: "create",
      title: "",
      start: now,
      end: later,
      allDay: false,
      owner: "both",
      notes: ""
    });
  });

  // Modal close handlers
  modalClose.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  // All-day toggles datetime inputs
  evtAllDay.addEventListener("change", () => {
    setDateTimeInputMode(evtAllDay.checked);
  });

  // Save
  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSave();
  });

  // Delete
  deleteBtn.addEventListener("click", async () => {
    if (!editingEventId) return;
    const ok = confirm("Delete this event?");
    if (!ok) return;
    await deleteDoc(doc(db, "events", editingEventId));
    closeModal();
  });
}

function openCreateModalFromSelection(info) {
  // FullCalendar provides start/end Date objects.
  const start = info.start;
  const end = info.end || null;

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
  evtAllDay.checked = !!payload.allDay;

  // Set input modes + values
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

async function handleSave() {
  const title = evtTitle.value.trim();
  if (!title) return;

  const allDay = evtAllDay.checked;
  const owner = evtOwner.value;
  const notes = evtNotes.value.trim();

  const start = fromInputValue(evtStart.value, allDay);
  const end = evtEnd.value ? fromInputValue(evtEnd.value, allDay) : null;

  // Basic sanity: end after start (if end provided)
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
  // Keep notes/owner/title unchanged; just update time fields
  const patch = {
    start: fcEvent.start ? fcEvent.start.toISOString() : null,
    end: fcEvent.end ? fcEvent.end.toISOString() : null,
    allDay: fcEvent.allDay,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, "events", fcEvent.id), patch);
}

// ---------- Helpers ----------
function normalizeEventForCalendar(e) {
  const style = OWNER_STYLE[e.owner] || OWNER_STYLE.both;
  const notes = e.notes || "";

  // Show notes in list view tooltip-ish (native title attribute)
  const titleAttr = notes ? `${e.title}\n\nNotes: ${notes}` : e.title;

  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end || undefined,
    allDay: !!e.allDay,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: "#e9ecf1",
    extendedProps: {
      owner: e.owner || "both",
      notes
    },
    // This becomes an HTML title tooltip in many browsers
    display: "auto",
    titleAttr
  };
}

// Convert Date -> input value in local time (no timezone suffix)
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

// Convert input value (local) -> Date
function fromInputValue(value, allDay) {
  if (allDay) {
    // Interpret as local midnight
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  // datetime-local parses as local time when using new Date("YYYY-MM-DDTHH:mm")
  return new Date(value);
}