// app.js — Hubert’s House (v12.2)
// Firebase sync + password gate + theme dice + search (with date bounds) + owner filter
// Upcoming + Outstanding checklist panels + checklist-focused modal
// Month title tap = jump-to-month + swipe left/right to change months
//
// FIXES / FEATURES ADDED:
// ✅ Calendar shows all-day events ON the “end date” (inclusive end for display)
// ✅ Removed list range (no more listRangeSelect); List view duration now derives from Dates popover
// ✅ Search + Dates are always the source of truth (search no longer “limited” by list view range)
// ✅ Dates popover outside-click closing works with new HTML structure
// ✅ Owner filter: selecting hanry/Karena includes "both" events too
// ✅ Theme→coat stripes handled by CSS vars; JS injects structured cat link for tail + blink
// ✅ Subtle tail wiggle (CSS) + occasional blink in cat mode (JS toggles .blink)
// ✅ Fixes common errors: sessionUnlocked exists before use; pawsTimer declared before used

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
  closeDetailsModal();
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

let updatesModalShownThisLoad = false;

// Show/hide gate immediately
if (isUnlocked()) gate?.classList.add("hidden");
else gate?.classList.remove("hidden");

// ---------- Topbar / controls ----------
const logoutBtn = document.getElementById("logoutBtn");
const themeBtn = document.getElementById("themeBtn");
const catModeBtn = document.getElementById("catModeBtn");

// Calendar nav buttons in the card row
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const todayBtn = document.getElementById("todayBtn");

const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");

const searchFiltersBtn = document.getElementById("searchFiltersBtn");
const closeSearchFiltersBtn = document.getElementById("closeSearchFiltersBtn");
const searchFilters = document.getElementById("searchFilters");
const searchFrom = document.getElementById("searchFrom");
const searchTo = document.getElementById("searchTo");
const clearDatesBtn = document.getElementById("clearDatesBtn");

const ownerFilter = document.getElementById("ownerFilter");
const fab = document.getElementById("fab");

logoutBtn?.addEventListener("click", lock);

// ---------- iOS modal scroll fix ----------
function scrollToTopSafely(el) {
  if (!el) return;
  requestAnimationFrame(() => {
    try { el.scrollTop = 0; } catch {}
  });
}

// ---------- Search UI state ----------
function setSearchUIState() {
  const hasText = !!(searchInput?.value || "").trim();
  const hasDates = !!(searchFrom?.value || searchTo?.value);

  searchClearBtn?.classList.toggle("hidden", !hasText);

  // Dates button visible when searching OR dates already set
  searchFiltersBtn?.classList.toggle("hidden", !(hasText || hasDates));
}

searchClearBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  searchText = "";
  setSearchUIState();
  applySearchAndFilters(true);
});

searchFiltersBtn?.addEventListener("click", () => {
  searchFilters?.classList.toggle("hidden");
  searchFiltersBtn?.classList.toggle(
    "is-active",
    !searchFilters?.classList.contains("hidden")
  );
});

closeSearchFiltersBtn?.addEventListener("click", () => {
  searchFilters?.classList.add("hidden");
  searchFiltersBtn?.classList.remove("is-active");
});

// Click outside popover closes it (works with your new HTML)
document.addEventListener("click", (e) => {
  if (!searchFilters || searchFilters.classList.contains("hidden")) return;

  // Use the whole search-wrap as the containment region
  const wrap = document.querySelector(".search-wrap");
  if (wrap && !wrap.contains(e.target)) {
    searchFilters.classList.add("hidden");
    searchFiltersBtn?.classList.remove("is-active");
  }
});

clearDatesBtn?.addEventListener("click", () => {
  if (searchFrom) searchFrom.value = "";
  if (searchTo) searchTo.value = "";
  setSearchUIState();
  applySearchAndFilters(true);
});

// ---------- Details Modal ----------
const detailsBackdrop = document.getElementById("detailsBackdrop");
const detailsClose = document.getElementById("detailsClose");
const detailsEditBtn = document.getElementById("detailsEditBtn");
const detailsDeleteBtn = document.getElementById("detailsDeleteBtn");
const detailsScroll = document.getElementById("detailsScroll");
const detailsChecklistBtn = document.getElementById("detailsChecklistBtn");

const detailsOwnerPill = document.getElementById("detailsOwnerPill");
const detailsTitle = document.getElementById("detailsTitle");
const detailsWhen = document.getElementById("detailsWhen");
const detailsType = document.getElementById("detailsType");
const detailsNotes = document.getElementById("detailsNotes");
const detailsChecklist = document.getElementById("detailsChecklist");

let detailsDocId = null;
let detailsOccurrenceStart = null;

function openDetailsModal(payload) {
  detailsDocId = payload.id;
  detailsOccurrenceStart = payload.occurrenceStart || null;

  const owner = normalizeOwner(payload.owner);
  const ownerLabel = owner === "custom" ? (payload.ownerCustom || "Other") : owner;

  if (detailsOwnerPill) detailsOwnerPill.textContent = ownerLabel;
  if (detailsTitle) detailsTitle.textContent = payload.title || "";
  if (detailsWhen) detailsWhen.textContent = formatWhenForPanel({
    start: payload.start ? new Date(payload.start) : null,
    end: payload.end ? new Date(payload.end) : null,
    allDay: !!payload.allDay
  });

  if (detailsType) detailsType.textContent = (payload.type || "general").replace(/^\w/, c => c.toUpperCase());

  const notesVal = (payload.notes || "").trim();
  if (detailsNotes) detailsNotes.textContent = notesVal ? notesVal : "—";

  const items = Array.isArray(payload.checklist) ? payload.checklist : [];
  if (detailsChecklist) {
    if (!items.length) detailsChecklist.textContent = "—";
    else detailsChecklist.textContent = items.map(it => `${it.done ? "✅" : "⬜️"} ${it.text}`).join("\n");
  }

  detailsBackdrop?.classList.remove("hidden");
  scrollToTopSafely(detailsScroll);
}

function closeDetailsModal() {
  detailsDocId = null;
  detailsOccurrenceStart = null;
  detailsBackdrop?.classList.add("hidden");
}

detailsClose?.addEventListener("click", closeDetailsModal);
detailsBackdrop?.addEventListener("click", (e) => {
  if (e.target === detailsBackdrop) closeDetailsModal();
});

detailsChecklistBtn?.addEventListener("click", () => {
  if (!detailsDocId) return;
  const docData = rawDocs.find(d => d.id === detailsDocId);
  if (!docData) return;

  closeDetailsModal();
  openTaskModal(docData, detailsOccurrenceStart);
});



// ---------- Modal: event editor ----------
const backdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const eventForm = document.getElementById("eventForm");
const modalTitle = document.getElementById("modalTitle");
const editScroll = document.getElementById("editScroll");

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

// ---------- Checklist-focused modal ----------
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

// Panels
const upcomingListEl = document.getElementById("upcomingList");
const outstandingListEl = document.getElementById("outstandingList");
// Updates (panel + modal)
const updatesListEl = document.getElementById("updatesList");

const updatesBackdrop = document.getElementById("updatesBackdrop");
const updatesClose = document.getElementById("updatesClose");
const updatesDone = document.getElementById("updatesDone");
const updatesModalList = document.getElementById("updatesModalList");
const updatesDontShow = document.getElementById("updatesDontShow");

const LS_UPDATES_HIDE = "huberts_house_updates_hide_v1";
const LS_UPDATES_LASTSEEN = "huberts_house_updates_lastseen_v1";

const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");

function closeUpdatesModal() {
  updatesBackdrop?.classList.add("hidden");
}

function openUpdatesModal(html) {
  if (updatesModalList) updatesModalList.innerHTML = html || "No new events.";
  updatesBackdrop?.classList.remove("hidden");
}

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

// ---------- Checklist presets ----------
const CHECKLIST_PRESETS = {
  general: [],
  wedding: ["RSVP", "Gift", "Travel", "Outfit", "Hotel"],
  trip: ["Book travel", "Lodging", "Packing list", "Car / rides", "Itinerary"],
  appointment: ["Add address", "Bring ID", "Arrive early", "Paperwork"],
  party: ["Invite list", "Food/drinks", "Music", "Supplies", "Cleanup plan"]
};

// ---------- Firebase ----------
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



// In-memory cache from Firestore
let rawDocs = [];         // [{id,...data}]
let expandedEvents = [];  // normalized + expanded repeats (each has sourceId)

let editingDocId = null;
let editingOccurrenceStart = null;

// Outstanding pagination
let outstandingPage = 1;
const OUT_PAGE_SIZE = 10;

// Search state
let searchText = "";

// Filter state
let ownerFilterValue = "all";

// ---------- Theme (dice) ----------
const LS_THEME = "huberts_house_theme_v1";
const LS_DESIGNS = "huberts_house_designs_v1";
const LS_FONT_DISPLAY = "huberts_house_font_display_v1";

const THEMES = ["aurora", "sunset", "mint", "grape", "mono"];
const DISPLAY_FONTS = [
  '-apple-system,system-ui,"SF Pro Display","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  '"Avenir Next",-apple-system,system-ui,Roboto,Helvetica,Arial,sans-serif',
  '"Trebuchet MS",-apple-system,system-ui,Roboto,Helvetica,Arial,sans-serif',
  '"Georgia",-apple-system,system-ui,Roboto,Helvetica,Arial,sans-serif'
];

function applyTheme(theme, designsOn, fontDisplay) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("designs-on", !!designsOn);
  if (fontDisplay) document.documentElement.style.setProperty("--font-display", fontDisplay);
}

function restoreTheme() {
  const theme = localStorage.getItem(LS_THEME) || "aurora";
  const designsOn = (localStorage.getItem(LS_DESIGNS) || "1") === "1";
  const fontDisplay = localStorage.getItem(LS_FONT_DISPLAY) || DISPLAY_FONTS[0];
  applyTheme(theme, designsOn, fontDisplay);
}

function pickTheme() {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const designsOn = Math.random() < 0.8;
  const fontDisplay = DISPLAY_FONTS[Math.floor(Math.random() * DISPLAY_FONTS.length)];

  localStorage.setItem(LS_THEME, theme);
  localStorage.setItem(LS_DESIGNS, designsOn ? "1" : "0");
  localStorage.setItem(LS_FONT_DISPLAY, fontDisplay);

  applyTheme(theme, designsOn, fontDisplay);
}

themeBtn?.addEventListener("click", () => pickTheme());

// ---------- Cat link: inject structured markup for tail + blink ----------
function ensureCatLinkMarkup() {
  const a = document.querySelector(".catlink");
  if (!a) return;
  if (!a.id) a.id = "catLink";

  // If it already has the inner structure, leave it
  if (a.querySelector(".catlink-inner")) return;

  a.innerHTML = `
    <span class="catlink-inner" aria-hidden="true">
      <span class="cat-face">🐈‍⬛</span>
      <span class="cat-tail">〰️</span>
    </span>
  `;
}

function setCatFaceEmoji(emoji) {
  const face = document.querySelector("#catLink .cat-face");
  if (face) face.textContent = emoji;
}

// ---------- Cat mode ----------
const LS_CATMODE = "huberts_house_catmode_v1";
let pawsTimer = null;   // declare BEFORE use (prevents “before initialization”)
let blinkTimer = null;

const catLayer = document.getElementById("catLayer");

function setCatMode(on) {
  document.documentElement.classList.toggle("cat-mode", !!on);
  localStorage.setItem(LS_CATMODE, on ? "1" : "0");
  if (catLayer) catLayer.classList.toggle("hidden", !on);

  if (on) {
    startCatAmbient();
    startBlinking();
    setCatFaceEmoji("😼");
  } else {
    stopCatAmbient();
    stopBlinking();
    setCatFaceEmoji("🐈‍⬛");
  }
}

catModeBtn?.addEventListener("click", () => {
  const on = !document.documentElement.classList.contains("cat-mode");
  setCatMode(on);
});

function startCatAmbient() {
  if (!catLayer) return;
  catLayer.classList.remove("hidden");
  catLayer.innerHTML = "";

  const makePaw = () => {
    const paw = document.createElement("div");
    paw.textContent = "🐾";
    paw.style.position = "absolute";
    paw.style.left = Math.round(Math.random() * 92) + "%";
    paw.style.top = "110%";
    paw.style.fontSize = (12 + Math.random() * 18).toFixed(0) + "px";
    paw.style.opacity = (0.10 + Math.random() * 0.20).toFixed(2);
    paw.style.transform = `rotate(${Math.round(Math.random() * 40 - 20)}deg)`;
    paw.style.transition = "top 6.5s linear, opacity 6.5s linear";
    catLayer.appendChild(paw);

    requestAnimationFrame(() => {
      paw.style.top = "-10%";
      paw.style.opacity = "0";
    });

    setTimeout(() => paw.remove(), 7000);
  };

  if (pawsTimer) clearInterval(pawsTimer);
  pawsTimer = setInterval(() => {
    if (!document.documentElement.classList.contains("cat-mode")) return;
    makePaw();
  }, 900);
}

function stopCatAmbient() {
  if (pawsTimer) clearInterval(pawsTimer);
  pawsTimer = null;
  if (catLayer) catLayer.innerHTML = "";
}

// Occasional blink: toggle #catLink.blink for ~120ms
function startBlinking() {
  stopBlinking();
  const schedule = () => {
    const delay = 4500 + Math.random() * 6500; // 4.5–11s
    blinkTimer = setTimeout(() => {
      if (!document.documentElement.classList.contains("cat-mode")) return schedule();
      const el = document.getElementById("catLink");
      if (el) {
        el.classList.add("blink");
        setTimeout(() => el.classList.remove("blink"), 120);
      }
      schedule();
    }, delay);
  };
  schedule();
}

function stopBlinking() {
  if (blinkTimer) clearTimeout(blinkTimer);
  blinkTimer = null;
  const el = document.getElementById("catLink");
  el?.classList.remove("blink");
}

// ---------- Init ----------
restoreTheme();
ensureCatLinkMarkup();
setCatMode((localStorage.getItem(LS_CATMODE) || "0") === "1");
setSearchUIState();

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
    alert("Firebase sync error. Check rules + config.");
  });
}

// ---------- UI hooks ----------
function initUIHooks() {
  // Calendar card nav buttons
  prevBtn?.addEventListener("click", () => calendar?.prev());
  nextBtn?.addEventListener("click", () => calendar?.next());
  todayBtn?.addEventListener("click", () => calendar?.today());

  updatesClose?.addEventListener("click", closeUpdatesModal);
  updatesDone?.addEventListener("click", () => {
    if (updatesDontShow?.checked) localStorage.setItem(LS_UPDATES_HIDE, "1");
    closeUpdatesModal();
  });
  updatesBackdrop?.addEventListener("click", (e) => {
    if (e.target === updatesBackdrop) closeUpdatesModal();
  });

  // Search debounce
  let t = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      searchText = (searchInput.value || "").trim();
      setSearchUIState();
      applySearchAndFilters(true);
    }, 160);
  });

  searchFrom?.addEventListener("change", () => {
    setSearchUIState();
    applySearchAndFilters(true);
  });

  searchTo?.addEventListener("change", () => {
    setSearchUIState();
    applySearchAndFilters(true);
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

  modalClose?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  evtAllDay?.addEventListener("change", () => {
    preserveDatesOnAllDayToggle(!!evtAllDay.checked);
  });

  // Start/end guardrails
  evtStart?.addEventListener("change", () => {
    clampEndToStart({ alsoFillIfBlank: true });
  });

  evtEnd?.addEventListener("change", () => {
    clampEndToStart({ alsoFillIfBlank: false });
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

  // Click legend items to filter owner
  document.querySelectorAll(".legend-inline .item").forEach((item) => {
    item.style.cursor = "pointer";

    item.addEventListener("click", () => {
      const label = item.textContent.trim().toLowerCase();

      let next = "all";
      if (label.includes("hanry")) next = "hanry";
      else if (label.includes("karena")) next = "karena";
      else if (label.includes("both")) next = "both";
      else if (label.includes("other")) next = "custom";

      if ((ownerFilter?.value || "all") === next) {
        ownerFilter.value = "all";
        ownerFilterValue = "all";
      } else {
        ownerFilter.value = next;
        ownerFilterValue = next;
      }

      applySearchAndFilters(false);
    });
  });

  populateYearSelect();
}

// ---------- Calendar ----------
function initCalendarUI() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

calendar = new FullCalendar.Calendar(calendarEl, {
  initialView: "dayGridMonth",
  headerToolbar: {
    left: "",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay,listCustom"
  },
  
eventContent: function(arg) {
  function formatMonthTime(date) {
    if (!date) return "";

    const mins = date.getMinutes();
    const opts = {
      hour: "numeric",
      minute: mins === 0 ? undefined : "2-digit"
    };

    let s = date.toLocaleTimeString([], opts).toLowerCase();
    s = s.replace(" am", "a").replace(" pm", "p").replace(":00", "");
    return s;
  }

  function getTypeIcon(type) {
    switch ((type || "").toLowerCase()) {
      case "trip": return "✈️";
      case "wedding": return "💍";
      case "appointment": return "📅";
      case "party": return "🎉";
      default: return "";
    }
  }

  const wrapper = document.createElement("div");
  wrapper.className = "fc-custom-event";

  const isAllDay = arg.event.allDay;

  if (!isAllDay) {
    const dot = document.createElement("span");
    dot.className = "fc-dot";

    const bg =
      arg.event.backgroundColor ||
      arg.event.extendedProps?.backgroundColor ||
      "#7aa2ff";

    dot.style.background = bg;

    const time = document.createElement("span");
    time.className = "fc-time";
    time.innerText = formatMonthTime(arg.event.start);

    const row1 = document.createElement("div");
    row1.className = "fc-row1";
    row1.append(dot, time);

    wrapper.append(row1);
  }

  const icon = document.createElement("span");
  icon.className = "fc-type-icon";
  icon.innerText = getTypeIcon(arg.event.extendedProps?.type);

  const titleText = document.createElement("span");
  titleText.className = "fc-title-text";
  titleText.innerText = arg.event.title;

  const title = document.createElement("div");
  title.className = "fc-title";
  title.append(icon, titleText);

  wrapper.append(title);

    const start = arg.event.start;
  const end = arg.event.end;
  const date = arg.date;

  const isMultiDay =
    isAllDay &&
    start &&
    end &&
    (new Date(end).getTime() - new Date(start).getTime()) > 24 * 60 * 60 * 1000;

  if (isMultiDay) {
    wrapper.classList.add("fc-multiday");
  }

  if (start && end && arg.event.allDay) {

  const startDay = new Date(start);
  startDay.setHours(0,0,0,0);

  const endDay = new Date(end);
  endDay.setHours(0,0,0,0);

  const curDay = new Date(date);
  curDay.setHours(0,0,0,0);

  if (curDay.getTime() === startDay.getTime()) {
    wrapper.classList.add("multi-start");
  }
  else if (curDay.getTime() === endDay.getTime()) {
    wrapper.classList.add("multi-end");
  }
  else {
    wrapper.classList.add("multi-middle");
  }

}
  return { domNodes: [wrapper] };
},

views: {
  dayGridMonth: {
    eventDisplay: "auto",
    displayEventTime: true,
    eventTimeFormat: {
      hour: "numeric",
      meridiem: "narrow"
    }
  },
  listCustom: {
    type: "list",
    duration: { days: 14 },
    buttonText: "List"
  }
},

  selectable: true,
  editable: true,
  nowIndicator: true,
  height: "auto",
  longPressDelay: 350,
  selectLongPressDelay: 350,

    datesSet: () => hookMonthTitleClick(),

    // Month day tap opens Day view; other views create an event
    dateClick: (info) => {
      if (calendar?.view?.type === "dayGridMonth") {
        calendar.changeView("timeGridDay", info.date);
      } else {
        const start = new Date(info.date);
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
      }
    },

    // drag-select creates an event
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

    // event tap opens Details modal
    eventClick: (info) => {
      const ev = info.event;
      const p = ev.extendedProps || {};
      const sourceId = p.sourceId || ev.id;

      const docData = rawDocs.find(d => d.id === sourceId);
      if (!docData) return;

      const occStart = ev.start ? new Date(ev.start) : (docData.start ? new Date(docData.start) : null);

      openDetailsModal({
        id: sourceId,
        occurrenceStart: occStart,
        title: docData.title || "",
        start: occStart || (docData.start ? new Date(docData.start) : null),
        end: docData.end ? new Date(docData.end) : (ev.end ? new Date(ev.end) : null),
        allDay: !!docData.allDay,
        owner: normalizeOwner(docData.owner),
        ownerCustom: docData.ownerCustom || "",
        type: docData.type || "general",
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

  // NEW: make timed month-view events use their event color
  if (arg.view.type === "dayGridMonth" && !arg.event.allDay) {
    arg.el.style.backgroundColor = arg.event.backgroundColor || "rgba(122,162,255,0.35)";
    arg.el.style.borderColor = arg.event.borderColor || "rgba(122,162,255,0.85)";
    arg.el.style.color = "#eef1f7";
  }
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
  scrollToTopSafely(jumpBackdrop?.querySelector(".modal-scroll"));
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

// Swipe left/right to change months (only in month view)
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

    if (calendar?.view?.type !== "dayGridMonth") return;

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
  renderUpdates();
}

function renderUpdates() {
  
  if (!updatesListEl) return;

  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Use rawDocs so we’re truly “added recently”, not just repeats
  const recent = rawDocs
    .map(d => {
      const createdAt =
        d.createdAt?.toDate ? d.createdAt.toDate() :
        d.createdAt instanceof Date ? d.createdAt :
        d.createdAt ? new Date(d.createdAt) : null;

      return {
        id: d.id,
        title: d.title || "",
        start: d.start ? new Date(d.start) : null,
        owner: normalizeOwner(d.owner),
        ownerCustom: d.ownerCustom || "",
        type: d.type || "general",
        notes: d.notes || "",
        checklist: Array.isArray(d.checklist) ? d.checklist : [],
        createdAt
      };
    })
    .filter(x => x.createdAt && x.createdAt >= cutoff)
    .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12);

  if (!recent.length) {
    updatesListEl.textContent = "No new events in the last 7 days.";
    return;
  }

  const html = recent.map(d => {
    const ownerLabel = d.owner === "custom" ? (d.ownerCustom || "Other") : d.owner;
    const when = d.start ? formatWhenForPanel({ start: d.start, end: null, allDay: false }) : "—";
    const style = OWNER_STYLE[d.owner] || OWNER_STYLE.custom;

    return `
      <div class="panel-card" data-open-id="${d.id}" style="border-left: 5px solid ${style.border}; cursor:pointer;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span class="owner-pill">${escapeHtml(ownerLabel)}</span>
          <strong style="font-size:16px;">${escapeHtml(d.title)}</strong>
        </div>
        <div class="tiny muted">${escapeHtml(when)}</div>
        <div class="tiny muted">Added: ${escapeHtml(d.createdAt.toLocaleString())}</div>
      </div>
    `;
  }).join("");

  updatesListEl.innerHTML = html;

  updatesListEl.querySelectorAll("[data-open-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-open-id");
      openFromPanel(id, null, false);
    });
  });
  
  function maybeShowUpdatesModal(html, recent) {
  // respect “don’t show”
  if ((localStorage.getItem(LS_UPDATES_HIDE) || "0") === "1") return;

  // only once per page load
  if (updatesModalShownThisLoad) return;

  const lastSeenMs = Number(localStorage.getItem(LS_UPDATES_LASTSEEN) || "0");

  // newest createdAt among items in our "recent" list
  const newestMs = recent?.[0]?.createdAt ? recent[0].createdAt.getTime() : 0;

  // IMPORTANT: advance last-seen on every render (so "last visit" is real),
  // even if there are no new items.
  if (newestMs && newestMs > lastSeenMs) {
    // Build popup content = ONLY items newer than lastSeen
    const onlyNew = recent.filter(r => r.createdAt && r.createdAt.getTime() > lastSeenMs);

    if (onlyNew.length) {
      const newHtml = onlyNew.map(d => {
        const ownerLabel = d.owner === "custom" ? (d.ownerCustom || "Other") : d.owner;
        const when = d.start ? formatWhenForPanel({ start: d.start, end: null, allDay: false }) : "—";
        const style = OWNER_STYLE[d.owner] || OWNER_STYLE.custom;

        return `
          <div class="panel-card" style="border-left: 5px solid ${style.border};">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
              <span class="owner-pill">${escapeHtml(ownerLabel)}</span>
              <strong style="font-size:16px;">${escapeHtml(d.title)}</strong>
            </div>
            <div class="tiny muted">${escapeHtml(when)}</div>
            <div class="tiny muted">Added: ${escapeHtml(d.createdAt.toLocaleString())}</div>
          </div>
        `;
      }).join("");

      openUpdatesModal(newHtml);
      updatesModalShownThisLoad = true;
    }

    // After deciding whether to show, record newest as last seen
    localStorage.setItem(LS_UPDATES_LASTSEEN, String(newestMs));
    return;
  }

  // If nothing is newer, still mark "visited now" so next time is truly "since last visit"
  // (prevents old items from triggering later if clocks/timestamps resolve late)
  if (!lastSeenMs) {
    localStorage.setItem(LS_UPDATES_LASTSEEN, String(Date.now()));
  }
}
  

  // Also prep modal content + maybe show it
  maybeShowUpdatesModal(html, recent);
}

// NOTE: We filter by *event start* for search bounds.
// The big “search doesn’t work outside list range” issue is solved by setting listCustom duration from bounds.
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

function shouldShowEvent(fcEvent) {
  const p = fcEvent.extendedProps || {};
  const owner = normalizeOwner(p.owner);

  if (ownerFilterValue && ownerFilterValue !== "all") {
    // hanry/Karena should also show "both"
    if (ownerFilterValue === "hanry") {
      if (!(owner === "hanry" || owner === "both")) return false;
    } else if (ownerFilterValue === "karena") {
      if (!(owner === "karena" || owner === "both")) return false;
    } else {
      if (ownerFilterValue !== owner) return false;
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

function matchOwnerFilter(e) {
  if (!ownerFilterValue || ownerFilterValue === "all") return true;
  const o = normalizeOwner(e.extendedProps?.owner);

  if (ownerFilterValue === "hanry") return (o === "hanry" || o === "both");
  if (ownerFilterValue === "karena") return (o === "karena" || o === "both");
  return o === ownerFilterValue;
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
  const to = toVal ? new Date(toVal + "T23:59:59") : null; // inclusive end day
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
    openListViewForSearch();
  }
}

// List view now derives from search bounds; if no bounds, it expands wide enough to find stuff.
function openListViewForSearch() {
  if (!calendar) return;

  const bounds = getSearchBounds();
  let days = 14;
  let anchorDate = new Date();

  if (bounds?.from && bounds?.to) {
    const ms = bounds.to.getTime() - bounds.from.getTime();
    days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)) + 1);
    anchorDate = bounds.from;
  } else if (bounds?.from && !bounds?.to) {
    days = 60;
    anchorDate = bounds.from;
  } else if (!bounds?.from && bounds?.to) {
    days = 60;
    anchorDate = new Date(bounds.to.getFullYear(), bounds.to.getMonth(), bounds.to.getDate());
    anchorDate.setDate(anchorDate.getDate() - 30);
  } else {
    // text-only search: show a generous window
    days = 365;
    anchorDate = new Date();
  }

  calendar.setOption("views", {
    listCustom: { type: "list", duration: { days }, buttonText: "List" }
  });

  calendar.changeView("listCustom");
  calendar.gotoDate(anchorDate);
}

// ---------- Upcoming ----------
function renderUpcoming() {
  if (!upcomingListEl) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  let list = expandedEvents.slice();
  list = list.filter(matchOwnerFilter);
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
      openFromPanel(id, occ, false);
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
  list = list.filter(matchOwnerFilter);
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
      openFromPanel(id, occ, true);
    });
  });
}

function openFromPanel(sourceId, occurrenceStartISO, checklistView) {
  const docData = rawDocs.find(d => d.id === sourceId);
  if (!docData) return;

  const occStart = occurrenceStartISO
    ? new Date(occurrenceStartISO)
    : (docData.start ? new Date(docData.start) : null);

  if (checklistView) {
    openTaskModal(docData, occStart);
  } else {
    openDetailsModal({
      id: sourceId,
      occurrenceStart: occStart,
      title: docData.title || "",
      start: occStart || (docData.start ? new Date(docData.start) : null),
      end: docData.end ? new Date(docData.end) : null,
      allDay: !!docData.allDay,
      owner: normalizeOwner(docData.owner),
      ownerCustom: docData.ownerCustom || "",
      type: docData.type || "general",
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
clampEndToStart({ alsoFillIfBlank: true });


  renderChecklistUI(checklistEl, payload.checklist || []);
  if (evtNotes) evtNotes.value = payload.notes || "";

  backdrop?.classList.remove("hidden");

  scrollToTopSafely(editScroll);
  setTimeout(() => evtTitle?.focus(), 0);
}

function closeModal() {
  editingDocId = null;
  editingOccurrenceStart = null;
  backdrop?.classList.add("hidden");
}

function setEndMinFromStart() {
  if (!evtStart || !evtEnd) return;
  evtEnd.min = evtStart.value || "";
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

// If end is blank OR before start, set it to a sensible default:
// - all-day: end = start
// - timed:  end = start + 1 hour
function clampEndToStart({ alsoFillIfBlank = true } = {}) {
  if (!evtStart || !evtEnd) return;

  const allDay = (evtStart.type === "date");
  const sVal = evtStart.value;
  if (!sVal) return;

  setEndMinFromStart();

  const eVal = evtEnd.value;

  // Decide default end based on mode
  const sDate = fromInputValue(sVal, allDay);
  const defaultEndDate = allDay ? sDate : addHours(sDate, 1);
  const defaultEndVal = toInputValue(defaultEndDate, allDay);

  // If end is empty, optionally fill it
  if (!eVal) {
    if (alsoFillIfBlank) evtEnd.value = defaultEndVal;
    return;
  }

  // If end < start, clamp it
  const eDate = fromInputValue(eVal, allDay);
  if (eDate.getTime() < sDate.getTime()) {
    evtEnd.value = defaultEndVal;
  }
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

  // NEW: after changing input types, re-apply min + clamp
  clampEndToStart({ alsoFillIfBlank: true });
}

detailsEditBtn?.addEventListener("click", () => {
  if (!detailsDocId) return;
  const docData = rawDocs.find(d => d.id === detailsDocId);
  if (!docData) return;

  closeDetailsModal();
  openEventModal({
    mode: "edit",
    id: detailsDocId,
    occurrenceStart: detailsOccurrenceStart,
    title: docData.title || "",
    start: docData.start ? new Date(docData.start) : detailsOccurrenceStart,
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
});

detailsDeleteBtn?.addEventListener("click", async () => {
  if (!detailsDocId) return;
  if (!confirm("Delete this event?")) return;
  await deleteDoc(doc(db, "events", detailsDocId));
  closeDetailsModal();
});

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
  let end = evtEnd?.value ? fromInputValue(evtEnd.value, allDay) : null;

  // If all-day and end equals start, treat as single-day (avoid accidental 2-day)
  if (allDay && end && end.getTime() === start.getTime()) end = null;

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

async function persistMovedEvent(fcEvent) {
  const p = fcEvent.extendedProps || {};
  const sourceId = p.sourceId || fcEvent.id;

  const patch = {
    start: fcEvent.start ? fcEvent.start.toISOString() : null,
    end: fcEvent.end ? fcEvent.end.toISOString() : null,
    allDay: fcEvent.allDay,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, "events", sourceId), patch);
}

// ---------- Task modal ----------
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
  scrollToTopSafely(taskBackdrop?.querySelector(".modal-scroll"));

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

// ---------- Normalize docs + expand repeats ----------
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
  const horizonDays = 240;
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

    while (cur.getTime() <= stop.getTime() && count < 400) {
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

// IMPORTANT: FullCalendar treats all-day "end" as EXCLUSIVE.
// To make events show on the chosen end date, we add +1 day to end when allDay.
function makeInclusiveAllDayEnd(endDate) {
  if (!(endDate instanceof Date) || isNaN(endDate)) return null;
  const x = new Date(endDate);
  x.setDate(x.getDate() + 1);
  return x;
}

function makeFcEvent({ id, title, start, end, allDay, style, extra }) {
  let endForFc = end ? new Date(end) : null;
  if (allDay && endForFc) endForFc = makeInclusiveAllDayEnd(endForFc);

  return {
    id,
    title,
    start: start.toISOString(),
    end: endForFc ? endForFc.toISOString() : undefined,
    allDay: !!allDay,
    backgroundColor: style.bg,
    borderColor: style.border,
    textColor: "#e9ecf1",
    extendedProps: extra
  };
}

// ---------- Panel card rendering ----------
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

// ---------- Escape ----------
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Start ----------
initApp().catch((err) => {
  console.error("INIT FAIL:", err);
  const msg =
    (err && (err.code || err.name)) ? `${err.code || err.name}: ${err.message || err}` : String(err);
  alert("Firebase init failed:\n" + msg);
});