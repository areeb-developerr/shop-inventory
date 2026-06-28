export function parseMoney(value) {
  const cleaned = String(value ?? "").trim().replace(/,/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function parseQty(value) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function validateName(value) {
  const v = String(value ?? "").trim();
  if (!v) return "Name is required";
  if (v.length < 2) return "Name must be at least 2 characters";
  return null;
}

export function validatePhone(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const cleaned = v.replace(/[\s-]/g, "");
  if (!/^\+?\d{7,15}$/.test(cleaned)) return "Enter a valid phone number (7–15 digits)";
  return null;
}

export function validateMoney(value, opts = {}) {
  const { required = false, min = 0, max, fieldName = "Amount", allowNegative = false } = opts;
  const raw = String(value ?? "").trim();
  if (!raw) return required ? `${fieldName} is required` : null;
  const n = parseMoney(raw);
  if (Number.isNaN(n)) return `${fieldName} must be a valid number`;
  if (!allowNegative && n < min) return `${fieldName} cannot be less than ${min}`;
  if (allowNegative && n < min) return `${fieldName} is too low`;
  if (max !== undefined && n > max) return `${fieldName} cannot exceed ${max}`;
  return null;
}

export function validateQty(value, opts = {}) {
  const { required = true, min = 0, max, fieldName = "Quantity", integer = false } = opts;
  const raw = String(value ?? "").trim();
  if (!raw) return required ? `${fieldName} is required` : null;
  const n = parseQty(raw);
  if (Number.isNaN(n)) return `${fieldName} must be a valid number`;
  if (integer && !Number.isInteger(n)) return `${fieldName} must be a whole number`;
  if (n < min) return `${fieldName} must be at least ${min}`;
  if (max !== undefined && n > max) return `${fieldName} cannot exceed ${max}`;
  return null;
}

export function validateSelect(value, fieldName = "Selection") {
  if (!value && value !== 0) return `Please select ${fieldName.toLowerCase()}`;
  return null;
}

export function sanitizeMoneyInput(value) {
  let v = String(value).replace(/[^\d.-]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
  if (v.includes("-") && !v.startsWith("-")) v = v.replace(/-/g, "");
  return v;
}

export function sanitizeQtyInput(value, integer = false) {
  let v = String(value).replace(integer ? /[^\d]/g : /[^\d.]/g, "");
  if (!integer) {
    const parts = v.split(".");
    if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return v;
}

export function clampQty(value, min, max) {
  const n = parseQty(value);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
