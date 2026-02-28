// Mack Calendar
// - Simple client-side password gate (NOT real security)
// - Calendar UI via FullCalendar
// - Storage: Firestore (recommended) OR localStorage fallback

// --------- Password gate ----------
const PASSWORD = "Mack";
const LS_UNLOCK = "mack_calendar_unlocked";

const loginEl = document.getElementById("login");
const mainEl = document.getElementById("main");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");

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

function showMain() {
  loginEl.classList.add("hidden");
  mainEl.classList.remove("hidden");
  initCalendar();
}

// --------- Storage layer ----------
// Choose Firestore if configured; otherwise localStorage.
const LS_EVENTS = "mack_calendar_events_v1";

// Set to true after you paste Firebase config below
const USE_FIREBASE = false;

// ===== OPTIONAL FIREBASE SETUP =====
// If you want this to sync between you + your wife:
// 1) Create a Firebase project
// 2) Enable Firestore Database
// 3) Paste your firebaseConfig below
// 4) Set USE_FIREBASE = true
//
// Security note: since you asked for “no complex security”, this uses a *very open* Firestore rule
// in the README instructions. If you want, I can tighten it later.
let firebaseApi = null;

async function initFirebaseIfNeeded() {
  if (!USE_FIREBASE) return null;

  // Firebase v12 modular CDN imports
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
  const {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc
  } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

  const firebaseConfig = {
    // TODO: paste yours here
    // apiKey: "...",
    // authDomain: "...",
    // projectId: "...",
    // storageBucket: "...",
    // messagingSenderId: "...",
    // appId: "..."
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  firebaseApi = {
    db,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc
  };

  return firebaseApi;
}

async function loadEvents() {
  if (USE_FIREBASE) {
    await initFirebaseIfNeeded();
    const colRef = firebaseApi.collection(firebaseApi.db, "events");
    const snap = await firebaseApi.getDocs(colRef);
    const out = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
    return out;
  }

  // localStorage fallback
  const raw = localStorage.getItem(LS_EVENTS);
  return raw ? JSON.parse(raw) : [];
}

async function saveEvent(evt) {
  // evt: { title, start, end, allDay }
  if (USE_FIREBASE) {
    const colRef = firebaseApi.collection(firebaseApi.db, "events");
    const docRef = await firebaseApi.addDoc(colRef, evt);
    return { id: docRef.id, ...evt };
  }

  const events = await loadEvents();
  const id = crypto.randomUUID();
  const full = { id, ...evt };
  events.push(full);
  localStorage.setItem(LS_EVENTS, JSON.stringify(events));
  return full;
}

async function updateEvent(id, patch) {
  if (USE_FIREBASE) {
    const ref = firebaseApi.doc(firebaseApi.db, "events", id);
    await firebaseApi.updateDoc(ref, patch);
    return;
  }

  const events = await loadEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx >= 0) {
    events[idx] = { ...events[idx], ...patch };
    localStorage.setItem(LS_EVENTS, JSON.stringify(events));
  }
}

async function deleteEvent(id) {
  if (USE_FIREBASE) {
    const ref = firebaseApi.doc(firebaseApi.db, "events", id);
    await firebaseApi.deleteDoc(ref);
    return;
  }

  const events = await loadEvents();
  const filtered = events.filter(e => e.id !== id);
  localStorage.setItem(LS_EVENTS, JSON.stringify(filtered));
}

// --------- Calendar ----------
let calendar;

async function initCalendar() {
  statusEl.textContent = USE_FIREBASE ? "Sync: Firebase" : "Sync: This device only";

  const events = await loadEvents();

  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
    },
    selectable: true,
    editable: true,
    nowIndicator: true,
    height: "auto",

    events: events.map(e => normalizeEventForCalendar(e)),

    select: async (info) => {
      const title = prompt("Event title?");
      if (!title) return;

      const evt = {
        title,
        start: info.start.toISOString(),
        end: info.end ? info.end.toISOString() : null,
        allDay: info.allDay
      };

      const saved = await saveEvent(evt);
      calendar.addEvent(normalizeEventForCalendar(saved));
    },

    eventClick: async (info) => {
      const currentTitle = info.event.title;
      const action = prompt(
        `Edit title, or type DELETE to remove:\n\nCurrent: ${currentTitle}`,
        currentTitle
      );

      if (action === null) return;

      if (action.trim().toUpperCase() === "DELETE") {
        await deleteEvent(info.event.id);
        info.event.remove();
        return;
      }

      const newTitle = action.trim();
      if (!newTitle) return;

      await updateEvent(info.event.id, { title: newTitle });
      info.event.setProp("title", newTitle);
    },

    eventDrop: async (info) => {
      await persistMovedEvent(info.event);
    },
    eventResize: async (info) => {
      await persistMovedEvent(info.event);
    }
  });

  calendar.render();
}

function normalizeEventForCalendar(e) {
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end || undefined,
    allDay: !!e.allDay
  };
}

async function persistMovedEvent(fcEvent) {
  await updateEvent(fcEvent.id, {
    start: fcEvent.start ? fcEvent.start.toISOString() : null,
    end: fcEvent.end ? fcEvent.end.toISOString() : null,
    allDay: fcEvent.allDay
  });
}
