const { getSetting, setSetting } = require("./index");

let checkInterval = null;
let onSyncCallback = null;

function parseSyncTimes(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{1,2}:\d{2}$/.test(s))
    .map((s) => {
      const [h, m] = s.split(":").map(Number);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    });
}

function getSchedule() {
  return parseSyncTimes(process.env.SYNC_TIMES || "");
}

function currentSlotKey() {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `${now.toISOString().slice(0, 10)}-${hhmm}`;
}

function getNextScheduledAt() {
  const times = getSchedule();
  if (!times.length) return null;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const candidates = [];
  for (const t of times) {
    const d = new Date(`${today}T${t}:00`);
    if (d > now) candidates.push(d);
  }
  if (!candidates.length) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDay = tomorrow.toISOString().slice(0, 10);
    return new Date(`${nextDay}T${times[0]}:00`).toISOString();
  }
  return candidates.sort((a, b) => a - b)[0].toISOString();
}

function shouldRunNow() {
  const times = getSchedule();
  if (!times.length) return false;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (!times.includes(hhmm)) return false;
  const key = currentSlotKey();
  if (getSetting("lastScheduledSyncSuccessAt", "") === key) return false;
  return true;
}

function markScheduledSuccess() {
  setSetting("lastScheduledSyncSuccessAt", currentSlotKey());
}

function start(onSync) {
  onSyncCallback = onSync;
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => {
    if (shouldRunNow() && onSyncCallback) {
      onSyncCallback().catch(() => {});
    }
  }, 60 * 1000);
}

function stop() {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = null;
}

module.exports = {
  parseSyncTimes,
  getSchedule,
  getNextScheduledAt,
  shouldRunNow,
  markScheduledSuccess,
  start,
  stop,
};
