const DEFAULT_PEPTIDES = ["Retatrutide", "BPC157/TB500", "GHK-Cu"];
const STORAGE_KEY = "basic-peptide-injection-logs";
const PEPTIDE_COLORS = {
  Retatrutide: "#10b981",
  "BPC157/TB500": "#0ea5e9",
  "GHK-Cu": "#8b5cf6",
};
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const state = {
  activeTab: "home",
  editingId: null,
  entryType: "completed",
  logs: loadLogs(),
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  calendarPeptide: "all",
};

const elements = {
  favoriteGrid: document.querySelector("#favoriteGrid"),
  historyList: document.querySelector("#historyList"),
  homeScreen: document.querySelector("#homeScreen"),
  historyScreen: document.querySelector("#historyScreen"),
  calendarScreen: document.querySelector("#calendarScreen"),
  navButtons: document.querySelectorAll(".nav-button"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarPeptideInput: document.querySelector("#calendarPeptideInput"),
  calendarMonthInput: document.querySelector("#calendarMonthInput"),
  calendarYearInput: document.querySelector("#calendarYearInput"),
  entryDialog: document.querySelector("#entryDialog"),
  entryForm: document.querySelector("#entryForm"),
  dialogMode: document.querySelector("#dialogMode"),
  dialogTitle: document.querySelector("#dialogTitle"),
  peptideInput: document.querySelector("#peptideInput"),
  amountInput: document.querySelector("#amountInput"),
  amountValue: document.querySelector("#amountValue"),
  unitInput: document.querySelector("#unitInput"),
  unitPreview: document.querySelector("#unitPreview"),
  timestampInput: document.querySelector("#timestampInput"),
  typeToggle: document.querySelector("#typeToggle"),
  toggleButtons: document.querySelectorAll(".toggle-button"),
  saveButton: document.querySelector("#saveButton"),
  deleteButton: document.querySelector("#deleteButton"),
  missedButton: document.querySelector("#missedButton"),
  quickMissedButton: document.querySelector("#quickMissedButton"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
};

function loadLogs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveLogs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.logs));
}

function toDateTimeLocal(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  return new Date(value).toISOString();
}

function formatDateTime(isoTimestamp) {
  const date = new Date(isoTimestamp);
  return {
    date: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

function getSortedLogs() {
  return [...state.logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function isCompletedLog(log) {
  return log.type === "completed" || log.type === "completed injection";
}

function isMissedLog(log) {
  return log.type === "missed" || log.type === "missed injection";
}

function renderPeptideOptions() {
  elements.peptideInput.innerHTML = DEFAULT_PEPTIDES.map((peptide) => {
    return `<option value="${peptide}">${peptide}</option>`;
  }).join("");

  elements.calendarPeptideInput.innerHTML = [
    `<option value="all">All peptides</option>`,
    ...DEFAULT_PEPTIDES.map((peptide) => `<option value="${peptide}">${peptide}</option>`),
  ].join("");
}

function renderFavorites() {
  elements.favoriteGrid.innerHTML = DEFAULT_PEPTIDES.map((peptide) => {
    return `
      <button class="favorite-card" type="button" data-peptide="${peptide}" style="--peptide-color: ${PEPTIDE_COLORS[peptide]}">
        <span class="peptide-dot" aria-hidden="true"></span>
        <strong>${peptide}</strong>
        <span>Log Peptide</span>
      </button>
    `;
  }).join("");
}

function renderCalendarControls() {
  elements.calendarMonthInput.innerHTML = MONTHS.map((month, index) => {
    return `<option value="${index}">${month}</option>`;
  }).join("");
  elements.calendarMonthInput.value = String(state.calendarMonth);
  elements.calendarYearInput.value = String(state.calendarYear);
  elements.calendarPeptideInput.value = state.calendarPeptide;
}

function getCalendarEntriesByDay() {
  const entriesByDay = new Map();
  state.logs.forEach((log) => {
    const isCompleted = isCompletedLog(log);
    const isMissed = isMissedLog(log);
    if (!isCompleted && !isMissed) return;
    if (state.calendarPeptide !== "all" && log.peptide !== state.calendarPeptide) return;

    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) return;
    if (date.getMonth() !== state.calendarMonth || date.getFullYear() !== state.calendarYear) return;

    const day = date.getDate();
    const current = entriesByDay.get(day) ?? 0;
    const nextTotal = current + Number(log.amount || 0);
    entriesByDay.set(day, nextTotal);
  });
  return entriesByDay;
}

function renderCalendar() {
  const firstDay = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
  const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  const entriesByDay = getCalendarEntriesByDay();
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push(`<div class="calendar-day is-empty" aria-hidden="true"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const total = entriesByDay.get(day) ?? 0;
    const hasEntry = total > 0;
    const totalText = hasEntry ? `${Number(total.toFixed(2)).toString()} mg` : "";
    cells.push(`
      <div class="calendar-day ${hasEntry ? "has-dose" : ""}">
        <span class="day-number">${day}</span>
        ${hasEntry ? `<span class="day-total">${totalText}</span>` : ""}
      </div>
    `);
  }

  elements.calendarGrid.innerHTML = cells.join("");
}

function renderHistory() {
  const logs = getSortedLogs();

  if (!logs.length) {
    elements.historyList.innerHTML = `<div class="empty-state">No logs yet. Your completed and missed injections will show here.</div>`;
    return;
  }

  elements.historyList.innerHTML = logs.map((log) => {
    const formatted = formatDateTime(log.timestamp);
    const isMissed = isMissedLog(log);
    const dosage = `${log.amount || "0"} ${log.unit || "mg"}`;

    return `
      <button class="history-item" type="button" data-id="${log.id}">
        <div class="history-title-row">
          <strong>${escapeHtml(log.peptide)}</strong>
          <span class="status-pill ${isMissed ? "missed" : ""}">${isMissed ? "Missed" : "Completed"}</span>
        </div>
        <p class="history-meta">
          <span>${escapeHtml(dosage)}</span>
          <span>${formatted.date}</span>
          <span>${formatted.time}</span>
        </p>
      </button>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchTab(tab) {
  state.activeTab = tab;
  elements.homeScreen.classList.toggle("is-active", tab === "home");
  elements.historyScreen.classList.toggle("is-active", tab === "history");
  elements.calendarScreen.classList.toggle("is-active", tab === "calendar");
  elements.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tab);
  });
  if (tab === "calendar") {
    renderCalendarControls();
    renderCalendar();
  }
}

function setEntryType(type) {
  state.entryType = type;
  const isMissed = type === "missed";
  elements.dialogMode.textContent = isMissed ? "Missed injection" : "Completed injection";
  elements.saveButton.textContent = state.editingId ? "Save Changes" : isMissed ? "Add Missed" : "Log Now";
  elements.toggleButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.type === type);
  });
}

function updateDoseReadout() {
  elements.amountValue.textContent = Number(elements.amountInput.value).toString();
  elements.unitPreview.textContent = elements.unitInput.value.trim() || "mg";
}

function openEntryDialog({ peptide = DEFAULT_PEPTIDES[0], type = "completed", log = null } = {}) {
  state.editingId = log?.id ?? null;
  elements.dialogTitle.textContent = log ? "Edit entry" : type === "missed" ? "Add missed injection" : "Log dose";
  elements.peptideInput.value = log?.peptide ?? peptide;
  elements.amountInput.value = log?.amount ?? "0.5";
  elements.unitInput.value = log?.unit ?? "mg";
  elements.timestampInput.value = toDateTimeLocal(log ? new Date(log.timestamp) : new Date());
  elements.deleteButton.classList.toggle("is-visible", Boolean(log));
  setEntryType(log?.type ?? type);
  updateDoseReadout();
  elements.entryDialog.showModal();
}

function closeEntryDialog() {
  elements.entryDialog.close();
  elements.entryForm.reset();
  state.editingId = null;
}

function upsertLog(event) {
  event.preventDefault();
  const timestamp = fromDateTimeLocal(elements.timestampInput.value);
  const nextLog = {
    id: state.editingId ?? crypto.randomUUID(),
    peptide: elements.peptideInput.value,
    amount: elements.amountInput.value,
    unit: elements.unitInput.value.trim() || "mg",
    timestamp,
    type: state.entryType,
  };

  if (state.editingId) {
    state.logs = state.logs.map((log) => (log.id === state.editingId ? nextLog : log));
  } else {
    state.logs = [...state.logs, nextLog];
  }

  saveLogs();
  renderHistory();
  renderCalendar();
  closeEntryDialog();
  switchTab("history");
}

function deleteCurrentLog() {
  if (!state.editingId) return;
  state.logs = state.logs.filter((log) => log.id !== state.editingId);
  saveLogs();
  renderHistory();
  renderCalendar();
  closeEntryDialog();
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  elements.favoriteGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-peptide]");
    if (!button) return;
    openEntryDialog({ peptide: button.dataset.peptide, type: "completed" });
  });

  elements.historyList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (!item) return;
    const log = state.logs.find((entry) => entry.id === item.dataset.id);
    if (log) openEntryDialog({ log });
  });

  elements.typeToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (button) setEntryType(button.dataset.type);
  });

  elements.calendarPeptideInput.addEventListener("change", () => {
    state.calendarPeptide = elements.calendarPeptideInput.value;
    renderCalendar();
  });

  elements.calendarMonthInput.addEventListener("change", () => {
    state.calendarMonth = Number(elements.calendarMonthInput.value);
    renderCalendar();
  });

  elements.calendarYearInput.addEventListener("input", () => {
    state.calendarYear = Number(elements.calendarYearInput.value) || new Date().getFullYear();
    renderCalendar();
  });

  elements.entryForm.addEventListener("submit", upsertLog);
  elements.amountInput.addEventListener("input", updateDoseReadout);
  elements.unitInput.addEventListener("input", updateDoseReadout);
  elements.deleteButton.addEventListener("click", deleteCurrentLog);
  elements.closeDialogButton.addEventListener("click", closeEntryDialog);
  elements.missedButton.addEventListener("click", () => openEntryDialog({ type: "missed" }));
  elements.quickMissedButton.addEventListener("click", () => openEntryDialog({ type: "missed" }));

  elements.entryDialog.addEventListener("click", (event) => {
    if (event.target === elements.entryDialog) closeEntryDialog();
  });
}

renderPeptideOptions();
renderFavorites();
renderHistory();
renderCalendarControls();
renderCalendar();
bindEvents();
