import { getSettingsSync, saveSettings } from "./settings";
let cachedToken = null;

export function getAuthToken() {
  if (cachedToken !== null) return cachedToken;
  try {
    cachedToken = localStorage.getItem("auth_token") || "";
  } catch {}
  return cachedToken;
}

export function setAuthToken(token) {
  cachedToken = token || "";
  try {
    if (token) localStorage.setItem("auth_token", token);
    else localStorage.removeItem("auth_token");
  } catch {}
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function logout() {
  setAuthToken("");
}

export async function loginLocal(username, password) {
  const settings = getSettingsSync();
  const ok =
    String(username) === String(settings.authUsername) &&
    String(password) === String(settings.authPassword);
  if (!ok) throw new Error("Invalid credentials");
  const token = `local.${Date.now()}`;
  setAuthToken(token);
  return { token };
}

export async function changeCredentials({ username, password, currentPassword }) {
  const s = getSettingsSync();
  if (String(currentPassword) !== String(s.authPassword)) {
    throw new Error("Current password is incorrect");
  }
  const next = {
    ...s,
    authUsername: username ? String(username) : s.authUsername,
    authPassword: password ? String(password) : s.authPassword,
  };
  await saveSettings(next);
  return next;
}