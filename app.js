const DEFAULT_PEPTIDES = ["Retatrutide", "BPC157/TB500", "GHK-Cu"];
const STORAGE_KEY = "basic-peptide-injection-logs";
const PEPTIDE_STORAGE_KEY = "basic-peptide-list";
const FAVORITE_STORAGE_KEY = "favorite-peptide-list";
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
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
  favoritePeptides: loadFavoritePeptides(),
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  calendarPeptide: "all",
  supabase: null,
  user: null,
  syncReady: false,
  syncMessage: "",
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
  exportBackupButton: document.querySelector("#exportBackupButton"),
  importBackupButton: document.querySelector("#importBackupButton"),
  backupFileInput: document.querySelector("#backupFileInput"),
  backupStatus: document.querySelector("#backupStatus"),
  syncStatus: document.querySelector("#syncStatus"),
  authFields: document.querySelector("#authFields"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  signInButton: document.querySelector("#signInButton"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
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

function loadFavoritePeptides() {
  try {
    const saved = localStorage.getItem(FAVORITE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : DEFAULT_PEPTIDES;
    return [...new Set(parsed.filter(Boolean))];
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

function saveFavoritePeptides() {
  localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(state.favoritePeptides));
}

function setBackupStatus(message) {
  elements.backupStatus.textContent = message;
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
}

function renderSyncStatus() {
  if (!elements.syncStatus) return;

  if (!isSupabaseConfigured()) {
    elements.syncStatus.textContent = "Local only. Add Supabase keys in app.js to enable backup.";
    elements.authFields.style.display = "none";
    elements.signOutButton.style.display = "none";
    return;
  }

  elements.authFields.style.display = state.user ? "none" : "grid";
  elements.signOutButton.style.display = state.user ? "block" : "none";
  elements.syncStatus.textContent = state.user
    ? state.syncMessage || `Signed in as ${state.user.email}. Backup enabled.`
    : state.syncMessage || "Sign in to back up and restore your data.";
}

async function initializeSupabase() {
  if (!isSupabaseConfigured()) {
    renderSyncStatus();
    return;
  }

  state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await state.supabase.auth.getSession();
  state.user = data.session?.user ?? null;

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user ?? null;
    if (state.user) {
      await syncFromCloud();
    }
    renderSyncStatus();
  });

  if (state.user) {
    await syncFromCloud();
  }
  renderSyncStatus();
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

function mergeLogs(localLogs, cloudLogs) {
  const byId = new Map();
  [...localLogs, ...cloudLogs].forEach((log) => {
    if (!log?.id) return;
    byId.set(log.id, { ...byId.get(log.id), ...log });
  });
  return [...byId.values()];
}

function fromCloudLog(row) {
  return {
    id: row.id,
    peptide: row.peptide,
    amount: String(row.amount),
    unit: row.unit || "mg",
    timestamp: row.timestamp,
    type: "entry",
  };
}

function toCloudLog(log) {
  return {
    id: log.id,
    user_id: state.user.id,
    peptide: log.peptide,
    amount: Number(log.amount || 0),
    unit: log.unit || "mg",
    timestamp: log.timestamp,
    type: "entry",
    updated_at: new Date().toISOString(),
  };
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
  const favoritePeptides = state.favoritePeptides.filter((peptide) => state.peptides.includes(peptide));

  if (!favoritePeptides.length) {
    elements.favoriteGrid.innerHTML = `<div class="empty-state">No quick-entry favorites yet. Add favorites in Settings.</div>`;
    return;
  }

  elements.favoriteGrid.innerHTML = favoritePeptides.map((peptide) => {
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
    const isFavorite = state.favoritePeptides.includes(peptide);
    const favoriteButton = `<button class="favorite-toggle ${isFavorite ? "is-favorite" : ""}" type="button" data-favorite-peptide="${escapeHtml(peptide)}">${isFavorite ? "Favorited" : "Favorite"}</button>`;
    const removeButton = isDefault
      ? `<span class="default-pill">Default</span>`
      : `<button class="text-button" type="button" data-remove-peptide="${escapeHtml(peptide)}">Remove</button>`;

    return `
      <div class="settings-peptide" style="--peptide-color: ${getPeptideColor(peptide)}">
        <span class="peptide-dot" aria-hidden="true"></span>
        <strong>${escapeHtml(peptide)}</strong>
        ${favoriteButton}
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

async function upsertLog(event) {
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
  await saveLogToCloud(nextLog);
}

function deleteCurrentLog() {
  if (!state.editingId) return;
  const deletedId = state.editingId;
  state.logs = state.logs.filter((log) => log.id !== state.editingId);
  saveLogs();
  renderHistory();
  renderCalendar();
  closeEntryDialog();
  deleteLogFromCloud(deletedId);
}

function exportBackup() {
  const backup = {
    app: "SimplePep",
    version: 1,
    exportedAt: new Date().toISOString(),
    peptides: state.peptides,
    favoritePeptides: state.favoritePeptides,
    logs: state.logs,
  };
  const dateLabel = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `simplepep-backup-${dateLabel}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setBackupStatus("Backup downloaded. Save it to Google Drive or Files.");
}

function importBackup() {
  elements.backupFileInput.value = "";
  elements.backupFileInput.click();
}

async function restoreBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());
    const backupLogs = Array.isArray(backup.logs) ? backup.logs : [];
    const backupPeptides = Array.isArray(backup.peptides) ? backup.peptides : [];
    const backupFavorites = Array.isArray(backup.favoritePeptides) ? backup.favoritePeptides : [];

    state.logs = mergeLogs(state.logs, backupLogs);
    state.peptides = [...new Set([...DEFAULT_PEPTIDES, ...state.peptides, ...backupPeptides].filter(Boolean))];
    state.favoritePeptides = [
      ...new Set([...state.favoritePeptides, ...backupFavorites].filter((peptide) => state.peptides.includes(peptide))),
    ];
    saveLogs();
    savePeptides();
    saveFavoritePeptides();
    refreshPeptideUi();
    renderHistory();
    renderCalendar();
    setBackupStatus(`Restored ${backupLogs.length} entries from backup.`);
    await pushLocalDataToCloud();
  } catch {
    setBackupStatus("Could not restore that file. Please choose a SimplePep backup JSON file.");
  }
}

async function syncFromCloud() {
  if (!state.supabase || !state.user) return;

  state.syncMessage = "Syncing...";
  renderSyncStatus();

  const [{ data: cloudLogs, error: logsError }, { data: cloudPeptides, error: peptidesError }] = await Promise.all([
    state.supabase.from("peptide_logs").select("*").order("timestamp", { ascending: false }),
    state.supabase.from("user_peptides").select("name").order("name", { ascending: true }),
  ]);

  if (logsError || peptidesError) {
    state.syncMessage = logsError?.message || peptidesError?.message || "Sync failed.";
    renderSyncStatus();
    return;
  }

  state.logs = mergeLogs(state.logs, (cloudLogs || []).map(fromCloudLog));
  state.peptides = [...new Set([...DEFAULT_PEPTIDES, ...state.peptides, ...(cloudPeptides || []).map((row) => row.name)].filter(Boolean))];
  state.favoritePeptides = state.favoritePeptides.filter((peptide) => state.peptides.includes(peptide));
  saveLogs();
  savePeptides();
  saveFavoritePeptides();
  refreshPeptideUi();
  renderHistory();
  renderCalendar();

  await pushLocalDataToCloud();
  state.syncMessage = `Signed in as ${state.user.email}. Backup enabled.`;
  renderSyncStatus();
}

async function pushLocalDataToCloud() {
  if (!state.supabase || !state.user) return;

  const customPeptides = state.peptides
    .filter((peptide) => !DEFAULT_PEPTIDES.includes(peptide))
    .map((name) => ({ user_id: state.user.id, name }));

  if (customPeptides.length) {
    await state.supabase.from("user_peptides").upsert(customPeptides, { onConflict: "user_id,name" });
  }

  if (state.logs.length) {
    await state.supabase.from("peptide_logs").upsert(state.logs.map(toCloudLog));
  }
}

async function saveLogToCloud(log) {
  if (!state.supabase || !state.user) return;
  const { error } = await state.supabase.from("peptide_logs").upsert(toCloudLog(log));
  state.syncMessage = error ? error.message : `Signed in as ${state.user.email}. Backup enabled.`;
  renderSyncStatus();
}

async function deleteLogFromCloud(id) {
  if (!state.supabase || !state.user) return;
  const { error } = await state.supabase.from("peptide_logs").delete().eq("id", id);
  state.syncMessage = error ? error.message : `Signed in as ${state.user.email}. Backup enabled.`;
  renderSyncStatus();
}

async function savePeptideToCloud(peptide) {
  if (!state.supabase || !state.user || DEFAULT_PEPTIDES.includes(peptide)) return;
  const { error } = await state.supabase
    .from("user_peptides")
    .upsert({ user_id: state.user.id, name: peptide }, { onConflict: "user_id,name" });
  state.syncMessage = error ? error.message : `Signed in as ${state.user.email}. Backup enabled.`;
  renderSyncStatus();
}

async function deletePeptideFromCloud(peptide) {
  if (!state.supabase || !state.user || DEFAULT_PEPTIDES.includes(peptide)) return;
  const { error } = await state.supabase.from("user_peptides").delete().eq("name", peptide);
  state.syncMessage = error ? error.message : `Signed in as ${state.user.email}. Backup enabled.`;
  renderSyncStatus();
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

async function addPeptide(event) {
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
  await savePeptideToCloud(peptide);
}

async function removePeptide(event) {
  const button = event.target.closest("[data-remove-peptide]");
  if (!button) return;

  const peptide = button.dataset.removePeptide;
  state.peptides = state.peptides.filter((entry) => entry !== peptide);
  state.favoritePeptides = state.favoritePeptides.filter((entry) => entry !== peptide);
  if (state.calendarPeptide === peptide) {
    state.calendarPeptide = "all";
  }
  savePeptides();
  saveFavoritePeptides();
  refreshPeptideUi();
  await deletePeptideFromCloud(peptide);
}

function toggleFavoritePeptide(event) {
  const button = event.target.closest("[data-favorite-peptide]");
  if (!button) return;

  const peptide = button.dataset.favoritePeptide;
  if (state.favoritePeptides.includes(peptide)) {
    state.favoritePeptides = state.favoritePeptides.filter((entry) => entry !== peptide);
  } else {
    state.favoritePeptides = [...state.favoritePeptides, peptide];
  }
  saveFavoritePeptides();
  refreshPeptideUi();
}

async function signIn() {
  if (!state.supabase) return;
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  state.syncMessage = error ? error.message : "Signing in...";
  renderSyncStatus();
}

async function signUp() {
  if (!state.supabase) return;
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  const { error } = await state.supabase.auth.signUp({ email, password });
  state.syncMessage = error ? error.message : "Account created. Check email if confirmation is enabled.";
  renderSyncStatus();
}

async function signOut() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  state.user = null;
  state.syncMessage = "Signed out. Data remains on this device.";
  renderSyncStatus();
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
  elements.settingsPeptideList.addEventListener("click", toggleFavoritePeptide);
  elements.exportBackupButton.addEventListener("click", exportBackup);
  elements.importBackupButton.addEventListener("click", importBackup);
  elements.backupFileInput.addEventListener("change", restoreBackup);
  elements.signInButton.addEventListener("click", signIn);
  elements.signUpButton.addEventListener("click", signUp);
  elements.signOutButton.addEventListener("click", signOut);

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
initializeSupabase();
