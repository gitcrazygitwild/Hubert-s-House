// Hubert’s House — JS (Part 1)

// ===================================================
// PASSWORD GATE
// ===================================================

const PASSWORD = "Mack";
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
}

gateForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = String(gateInput?.value ?? "").trim();
  if (pw.toLowerCase() === PASSWORD.toLowerCase()) {
    unlock();
    gateInput.value = "";
  } else {
    gateInput.value = "";
    gateInput.focus();
    alert("Wrong password.");
  }
});

if (isUnlocked()) gate?.classList.add("hidden");
else gate?.classList.remove("hidden");


// ===================================================
// TOP BAR CONTROLS
// ===================================================

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");
const themeBtn = document.getElementById("themeBtn");
const focusBtn = document.getElementById("focusBtn");
const todayBtn = document.getElementById("todayBtn");

logoutBtn?.addEventListener("click", lock);


// ===================================================
// THEME + DENSITY (🎲 BUTTON)
// ===================================================

const LS_THEME = "huberts_house_theme_v1";
const LS_DENSITY = "huberts_house_density_v1";

const THEMES = ["aurora","sunset","mint","grape","mono"];
const DENSITIES = ["compact","cozy"];

function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(LS_THEME, theme);
}

function applyDensity(d){
  document.documentElement.dataset.density = d;
  localStorage.setItem(LS_DENSITY, d);
}

function cycleThemeAndDensity(){
  const curTheme = document.documentElement.dataset.theme || "aurora";
  const curDensity = document.documentElement.dataset.density || "cozy";

  const nextTheme = THEMES[(THEMES.indexOf(curTheme)+1)%THEMES.length];
  const nextDensity = DENSITIES[(DENSITIES.indexOf(curDensity)+1)%DENSITIES.length];

  applyTheme(nextTheme);
  applyDensity(nextDensity);
}

applyTheme(localStorage.getItem(LS_THEME) || "aurora");
applyDensity(localStorage.getItem(LS_DENSITY) || "cozy");

themeBtn?.addEventListener("click", cycleThemeAndDensity);


// ===================================================
// FOCUS MODE
// ===================================================

function setFocusMode(on){
  document.body.classList.toggle("focus-on", on);
  focusBtn?.setAttribute("aria-pressed", on ? "true" : "false");

  const upcoming = document.getElementById("upcoming");
  const outstanding = document.getElementById("outstanding");

  if(upcoming) upcoming.style.display = on ? "none" : "";
  if(outstanding) outstanding.style.display = on ? "none" : "";
}

focusBtn?.addEventListener("click", () => {
  const on = document.body.classList.contains("focus-on");
  setFocusMode(!on);
});


// ===================================================
// SEARCH + FILTERS
// ===================================================

const searchInput = document.getElementById("searchInput");
const searchFrom = document.getElementById("searchFrom");
const searchTo = document.getElementById("searchTo");
const listRangeSelect = document.getElementById("listRangeSelect");
const ownerFilter = document.getElementById("ownerFilter");

let searchText = "";
let ownerFilterValue = "all";

searchInput?.addEventListener("input", () => {
  searchText = (searchInput.value || "").trim().toLowerCase();
  renderCalendarFromCache();
});

ownerFilter?.addEventListener("change", () => {
  ownerFilterValue = ownerFilter.value;
  renderCalendarFromCache();
});


// ===================================================
// FIREBASE INIT
// ===================================================

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
  appId: "1:233498547172:web:e250d2f14b0e19c6322df1"
};

let db;
let eventsCol;
let calendar;

let rawDocs = [];
let expandedEvents = [];

function setStatus(kind,text){
  if(!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.status = kind;
}

async function initApp(){
  setStatus("connecting","Sync: connecting…");

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  eventsCol = collection(db,"events");

  initCalendar();

  const q = query(eventsCol, orderBy("start","asc"));
  onSnapshot(q,(snap)=>{
    const docs=[];
    snap.forEach(d=>docs.push({id:d.id,...d.data()}));
    rawDocs = docs;
    expandedEvents = expandRepeats(normalizeDocs(rawDocs));
    renderCalendarFromCache();
    setStatus("live","Sync: live");
  },()=>{
    setStatus("error","Sync: error");
  });
}


// ===================================================
// CALENDAR INIT
// ===================================================

function initCalendar(){
  const el = document.getElementById("calendar");

  calendar = new FullCalendar.Calendar(el,{
    initialView:"dayGridMonth",
    headerToolbar:{
      left:"prev,next",
      center:"title",
      right:"dayGridMonth,timeGridWeek,timeGridDay,listBtn"
    },
    customButtons:{
      listBtn:{ text:"List", click:()=>calendar.changeView("listWeek") }
    },
    selectable:true,
    editable:true,
    nowIndicator:true,
    height:"auto",

    dateClick:(info)=>{
      const start=new Date(info.date);
      start.setHours(9,0,0,0);
      const end=new Date(start.getTime()+60*60*1000);
      openEventModal({mode:"create",start,end});
    },

    eventClick:(info)=>{
      const id=info.event.id;
      const docData=rawDocs.find(d=>d.id===id);
      if(!docData) return;
      openEventModal({...docData,mode:"edit"});
    }
  });

  calendar.render();
  todayBtn?.addEventListener("click",()=>calendar.today());
}


// ===================================================
// EVENT MODAL + SAVE
// ===================================================

const backdrop=document.getElementById("modalBackdrop");
const modalClose=document.getElementById("modalClose");
const eventForm=document.getElementById("eventForm");

const evtTitle=document.getElementById("evtTitle");
const evtStart=document.getElementById("evtStart");
const evtEnd=document.getElementById("evtEnd");
const evtAllDay=document.getElementById("evtAllDay");
const evtOwner=document.getElementById("evtOwner");
const evtNotes=document.getElementById("evtNotes");

let editingDocId=null;

function openEventModal(data){
  backdrop.classList.remove("hidden");
  editingDocId=data.mode==="edit"?data.id:null;

  evtTitle.value=data.title||"";
  evtStart.value=data.start?toInputValue(new Date(data.start)):toInputValue(new Date());
  evtEnd.value=data.end?toInputValue(new Date(data.end)):"";
}

function closeModal(){
  backdrop.classList.add("hidden");
  editingDocId=null;
}

modalClose?.addEventListener("click",closeModal);
backdrop?.addEventListener("click",(e)=>{
  if(e.target===backdrop) closeModal();
});

eventForm?.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const title=evtTitle.value.trim();
  if(!title) return;

  const payload={
    title,
    start:new Date(evtStart.value).toISOString(),
    end:evtEnd.value?new Date(evtEnd.value).toISOString():null,
    notes:evtNotes.value||"",
    owner:evtOwner.value||"both",
    allDay:evtAllDay.checked,
    updatedAt:serverTimestamp()
  };

  if(editingDocId){
    await updateDoc(doc(db,"events",editingDocId),payload);
  }else{
    await addDoc(eventsCol,{...payload,createdAt:serverTimestamp()});
  }

  closeModal();
});


// ===================================================
// UTILITIES
// ===================================================

function toInputValue(date){
  const pad=n=>String(n).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeDocs(docs){
  return docs.map(d=>({
    id:d.id,
    title:d.title||"",
    start:new Date(d.start),
    end:d.end?new Date(d.end):null,
    owner:d.owner||"both",
    notes:d.notes||"",
    allDay:!!d.allDay,
    repeat:d.repeat||"none"
  }));
}

function expandRepeats(norm){
  return norm.map(d=>({
    id:d.id,
    title:d.title,
    start:d.start,
    end:d.end,
    allDay:d.allDay
  }));
}

function renderCalendarFromCache(){
  if(!calendar) return;
  calendar.removeAllEvents();

  expandedEvents.forEach(e=>{
    if(searchText && !e.title.toLowerCase().includes(searchText)) return;
    if(ownerFilterValue!=="all" && e.owner!==ownerFilterValue) return;
    calendar.addEvent(e);
  });
}


// ====== PANEL RENDERING (PART 2 STARTS HERE) ======

// ===================================================
// PANEL RENDERING
// ===================================================

const upcomingListEl = document.getElementById("upcomingList");
const outstandingListEl = document.getElementById("outstandingList");
const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");

let outstandingPage = 1;
const OUT_PAGE_SIZE = 8;

// ---------------- UPCOMING ----------------

function renderUpcoming() {
  if (!upcomingListEl) return;

  const now = new Date();

  const upcoming = expandedEvents
    .filter(e => new Date(e.start) >= now)
    .sort((a,b)=>new Date(a.start)-new Date(b.start))
    .slice(0,5);

  if (upcoming.length === 0) {
    upcomingListEl.textContent = "No upcoming events.";
    return;
  }

  upcomingListEl.innerHTML = upcoming.map(renderPanelItemHTML).join("");

  upcomingListEl.querySelectorAll("[data-open-id]").forEach(el=>{
    el.addEventListener("click",()=>{
      const id=el.getAttribute("data-open-id");
      const docData=rawDocs.find(d=>d.id===id);
      if(docData) openEventModal({...docData,mode:"edit"});
    });
  });
}


// ---------------- OUTSTANDING ----------------

function renderOutstanding() {
  if (!outstandingListEl) return;

  const withChecklist = rawDocs.filter(d =>
    Array.isArray(d.checklist) &&
    d.checklist.some(i=>!i.done)
  );

  const totalPages = Math.max(1, Math.ceil(withChecklist.length/OUT_PAGE_SIZE));
  outstandingPage = Math.min(outstandingPage,totalPages);

  const startIdx = (outstandingPage-1)*OUT_PAGE_SIZE;
  const pageItems = withChecklist.slice(startIdx,startIdx+OUT_PAGE_SIZE);

  outPage.textContent = `Page ${outstandingPage} / ${totalPages}`;

  if(pageItems.length===0){
    outstandingListEl.textContent="No outstanding checklist items 🎉";
    return;
  }

  outstandingListEl.innerHTML = pageItems.map(d=>{
    const total=d.checklist.length;
    const done=d.checklist.filter(i=>i.done).length;

    return `
      <div class="panel-item" data-open-id="${d.id}">
        <div>
          <strong>${escapeHtml(d.title)}</strong>
          <div class="tiny muted">${formatDate(new Date(d.start))}</div>
        </div>
        <div class="progress-pill">${done}/${total}</div>
      </div>
    `;
  }).join("");

  outstandingListEl.querySelectorAll("[data-open-id]").forEach(el=>{
    el.addEventListener("click",()=>{
      const id=el.getAttribute("data-open-id");
      const docData=rawDocs.find(d=>d.id===id);
      if(docData) openChecklistModal(docData);
    });
  });
}

outPrev?.addEventListener("click",()=>{
  outstandingPage=Math.max(1,outstandingPage-1);
  renderOutstanding();
});
outNext?.addEventListener("click",()=>{
  outstandingPage++;
  renderOutstanding();
});


// ===================================================
// CHECKLIST MODAL
// ===================================================

const taskBackdrop=document.getElementById("taskBackdrop");
const taskClose=document.getElementById("taskClose");
const taskDone=document.getElementById("taskDone");
const taskMeta=document.getElementById("taskMeta");
const taskChecklist=document.getElementById("taskChecklist");
const taskAddItem=document.getElementById("taskAddItem");

let taskDocId=null;

function openChecklistModal(docData){
  taskDocId=docData.id;

  taskMeta.textContent=`${docData.title} — ${formatDate(new Date(docData.start))}`;

  renderChecklistUI(taskChecklist,docData.checklist||[]);
  taskBackdrop.classList.remove("hidden");
}

function closeChecklistModal(){
  taskDocId=null;
  taskBackdrop.classList.add("hidden");
}

taskClose?.addEventListener("click",closeChecklistModal);
taskDone?.addEventListener("click",closeChecklistModal);
taskBackdrop?.addEventListener("click",(e)=>{
  if(e.target===taskBackdrop) closeChecklistModal();
});

taskAddItem?.addEventListener("click",()=>{
  addChecklistItemUI(taskChecklist,{text:"",done:false},true);
});

taskChecklist?.addEventListener("change",async()=>{
  if(!taskDocId) return;
  const checklist=readChecklistUI(taskChecklist);
  await updateDoc(doc(db,"events",taskDocId),{
    checklist,
    updatedAt:serverTimestamp()
  });
});


// ===================================================
// PANEL HELPERS
// ===================================================

function renderPanelItemHTML(e){
  return `
    <div class="panel-item" data-open-id="${e.id}">
      <div>
        <strong>${escapeHtml(e.title)}</strong>
        <div class="tiny muted">${formatDate(new Date(e.start))}</div>
      </div>
    </div>
  `;
}

function formatDate(date){
  return date.toLocaleDateString(undefined,{
    weekday:"short",
    month:"short",
    day:"numeric",
    hour:"numeric",
    minute:"2-digit"
  });
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


// ===================================================
// CHECKLIST UI HELPERS
// ===================================================

function renderChecklistUI(container,items){
  container.innerHTML="";
  items.forEach(i=>addChecklistItemUI(container,i,false));
}

function addChecklistItemUI(container,item,focus){
  const row=document.createElement("div");
  row.className="check-item";

  const cb=document.createElement("input");
  cb.type="checkbox";
  cb.checked=!!item.done;

  const input=document.createElement("input");
  input.type="text";
  input.value=item.text||"";

  const del=document.createElement("button");
  del.type="button";
  del.className="btn btn-ghost remove";
  del.textContent="✕";
  del.onclick=()=>row.remove();

  row.append(cb,input,del);
  container.appendChild(row);

  if(focus) input.focus();
}

function readChecklistUI(container){
  return Array.from(container.querySelectorAll(".check-item"))
    .map(row=>{
      const cb=row.querySelector('input[type="checkbox"]');
      const input=row.querySelector('input[type="text"]');
      return {text:input.value.trim(),done:cb.checked};
    })
    .filter(i=>i.text.length>0);
}


// ===================================================
// FINAL INIT
// ===================================================

function refreshAllPanels(){
  renderUpcoming();
  renderOutstanding();
}

function renderCalendarFromCache(){
  if(!calendar) return;
  calendar.removeAllEvents();

  expandedEvents.forEach(e=>{
    if(searchText && !e.title.toLowerCase().includes(searchText)) return;
    if(ownerFilterValue!=="all" && e.owner!==ownerFilterValue) return;
    calendar.addEvent(e);
  });

  refreshAllPanels();
}

initApp();