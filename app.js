const DEFAULT_PEPTIDES = ["Retatrutide", "BPC157/TB500", "GHK-Cu"];
const STORAGE_KEY = "basic-peptide-injection-logs";
const PEPTIDE_STORAGE_KEY = "basic-peptide-list";
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
  logs: loadLogs(),
  peptides: loadPeptides(),
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
  dialogTitle: document.querySelector("#dialogTitle"),
  peptideInput: document.querySelector("#peptideInput"),
  amountInput: document.querySelector("#amountInput"),
  amountValue: document.querySelector("#amountValue"),
  unitInput: document.querySelector("#unitInput"),
  unitPreview: document.querySelector("#unitPreview"),
  timestampInput: document.querySelector("#timestampInput"),
  saveButton: document.querySelector("#saveButton"),
  deleteButton: document.querySelector("#deleteButton"),
  addEntryButton: document.querySelector("#addEntryButton"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsForm: document.querySelector("#settingsForm"),
  newPeptideInput: document.querySelector("#newPeptideInput"),
  settingsPeptideList: document.querySelector("#settingsPeptideList"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
};

function loadLogs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadPeptides() {
  try {
    const saved = localStorage.getItem(PEPTIDE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return [...new Set([...DEFAULT_PEPTIDES, ...parsed].filter(Boolean))];
  } catch {
    return DEFAULT_PEPTIDES;
  }
}

function saveLogs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.logs));
}

function savePeptides() {
  const customPeptides = state.peptides.filter((peptide) => !DEFAULT_PEPTIDES.includes(peptide));
  localStorage.setItem(PEPTIDE_STORAGE_KEY, JSON.stringify(customPeptides));
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

function getPeptideColor(peptide) {
  if (PEPTIDE_COLORS[peptide]) return PEPTIDE_COLORS[peptide];
  const colors = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899", "#22c55e"];
  const total = [...peptide].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[total % colors.length];
}

function getLastDoseForPeptide(peptide) {
  const lastDose = getSortedLogs().find((log) => log.peptide === peptide && log.amount)?.amount ?? "0.5";
  return normalizeDoseForSlider(lastDose);
}

function normalizeDoseForSlider(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return "0.5";
  const clamped = Math.min(Math.max(number, 0), 5);
  const rounded = Math.round(clamped / 0.25) * 0.25;
  return rounded.toString();
}

function renderPeptideOptions() {
  elements.peptideInput.innerHTML = state.peptides.map((peptide) => {
    return `<option value="${peptide}">${peptide}</option>`;
  }).join("");

  elements.calendarPeptideInput.innerHTML = [
    `<option value="all">All peptides</option>`,
    ...state.peptides.map((peptide) => `<option value="${peptide}">${peptide}</option>`),
  ].join("");
}

function renderFavorites() {
  elements.favoriteGrid.innerHTML = state.peptides.map((peptide) => {
    return `
      <button class="favorite-card" type="button" data-peptide="${escapeHtml(peptide)}" style="--peptide-color: ${getPeptideColor(peptide)}">
        <span class="peptide-dot" aria-hidden="true"></span>
        <strong>${peptide}</strong>
        <span>Log Peptide</span>
      </button>
    `;
  }).join("");
}

function renderSettingsPeptides() {
  elements.settingsPeptideList.innerHTML = state.peptides.map((peptide) => {
    const isDefault = DEFAULT_PEPTIDES.includes(peptide);
    const removeButton = isDefault
      ? `<span class="default-pill">Default</span>`
      : `<button class="text-button" type="button" data-remove-peptide="${escapeHtml(peptide)}">Remove</button>`;

    return `
      <div class="settings-peptide" style="--peptide-color: ${getPeptideColor(peptide)}">
        <span class="peptide-dot" aria-hidden="true"></span>
        <strong>${escapeHtml(peptide)}</strong>
        ${removeButton}
      </div>
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
    elements.historyList.innerHTML = `<div class="empty-state">No logs yet. Your peptide entries will show here.</div>`;
    return;
  }

  elements.historyList.innerHTML = logs.map((log) => {
    const formatted = formatDateTime(log.timestamp);
    const dosage = `${log.amount || "0"} ${log.unit || "mg"}`;

    return `
      <button class="history-item" type="button" data-id="${log.id}">
        <div class="history-title-row">
          <strong>${escapeHtml(log.peptide)}</strong>
          <span>${escapeHtml(dosage)}</span>
        </div>
        <p class="history-meta">
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

function updateDoseReadout() {
  elements.amountValue.textContent = Number(elements.amountInput.value).toFixed(2);
  elements.unitPreview.textContent = elements.unitInput.value.trim() || "mg";
}

function openEntryDialog({ peptide = state.peptides[0], log = null } = {}) {
  state.editingId = log?.id ?? null;
  elements.dialogTitle.textContent = log ? "Edit entry" : "Log dose";
  elements.peptideInput.value = log?.peptide ?? peptide;
  elements.amountInput.value = log?.amount ?? getLastDoseForPeptide(elements.peptideInput.value);
  elements.unitInput.value = log?.unit ?? "mg";
  elements.timestampInput.value = toDateTimeLocal(log ? new Date(log.timestamp) : new Date());
  elements.deleteButton.classList.toggle("is-visible", Boolean(log));
  elements.saveButton.textContent = state.editingId ? "Save Changes" : "Log Now";
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
    type: "entry",
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

function refreshPeptideUi() {
  renderPeptideOptions();
  renderFavorites();
  renderSettingsPeptides();
  renderCalendarControls();
  renderCalendar();
}

function openSettingsDialog() {
  renderSettingsPeptides();
  elements.newPeptideInput.value = "";
  elements.settingsDialog.showModal();
}

function closeSettingsDialog() {
  elements.settingsDialog.close();
}

function addPeptide(event) {
  event.preventDefault();
  const peptide = elements.newPeptideInput.value.trim();
  if (!peptide || state.peptides.includes(peptide)) {
    elements.newPeptideInput.value = "";
    return;
  }

  state.peptides = [...state.peptides, peptide];
  savePeptides();
  elements.newPeptideInput.value = "";
  refreshPeptideUi();
}

function removePeptide(event) {
  const button = event.target.closest("[data-remove-peptide]");
  if (!button) return;

  const peptide = button.dataset.removePeptide;
  state.peptides = state.peptides.filter((entry) => entry !== peptide);
  if (state.calendarPeptide === peptide) {
    state.calendarPeptide = "all";
  }
  savePeptides();
  refreshPeptideUi();
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  elements.favoriteGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-peptide]");
    if (!button) return;
    openEntryDialog({ peptide: button.dataset.peptide });
  });

  elements.historyList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (!item) return;
    const log = state.logs.find((entry) => entry.id === item.dataset.id);
    if (log) openEntryDialog({ log });
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
  elements.peptideInput.addEventListener("change", () => {
    if (state.editingId) return;
    elements.amountInput.value = getLastDoseForPeptide(elements.peptideInput.value);
    updateDoseReadout();
  });
  elements.amountInput.addEventListener("input", updateDoseReadout);
  elements.unitInput.addEventListener("input", updateDoseReadout);
  elements.deleteButton.addEventListener("click", deleteCurrentLog);
  elements.closeDialogButton.addEventListener("click", closeEntryDialog);
  elements.addEntryButton.addEventListener("click", () => openEntryDialog());
  elements.settingsButton.addEventListener("click", openSettingsDialog);
  elements.closeSettingsButton.addEventListener("click", closeSettingsDialog);
  elements.settingsForm.addEventListener("submit", addPeptide);
  elements.settingsPeptideList.addEventListener("click", removePeptide);

  elements.entryDialog.addEventListener("click", (event) => {
    if (event.target === elements.entryDialog) closeEntryDialog();
  });

  elements.settingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.settingsDialog) closeSettingsDialog();
  });
}

renderPeptideOptions();
renderFavorites();
renderSettingsPeptides();
renderHistory();
renderCalendarControls();
renderCalendar();
bindEvents();
