/* Shared domain data for Clawz By Nurin */

export const SERVICES = [
  { id: "gp-plain", group: "Gel Polish", name: "Plain Color", price: 249 },
  { id: "gp-design", group: "Gel Polish", name: "With Design / Unli Charms", price: 299 },
  { id: "gp-detailed", group: "Gel Polish", name: "Detailed Design / Unli Charms", price: 349 },
  { id: "sg-plain", group: "Softgel Extension", name: "Plain Color", price: 299 },
  { id: "sg-mini", group: "Softgel Extension", name: "Minimalist Design / Unli Charms", price: 349 },
  { id: "sg-detailed", group: "Softgel Extension", name: "Detailed Design / Unli Charms", price: 399 },
];
export const PROMO_SERVICE = { id: "promo", group: "Promo", name: "₱299 Promo Set (see inspo post)", price: 299 };
export const REMOVAL_ONLY = { id: "removal-only", group: "Removal", name: "Removal only", price: 0 };

export const REMOVALS = [
  { id: "none", name: "No removal needed", price: 0 },
  { id: "rm-gel", name: "Gel Polish Removal", price: 49 },
  { id: "rm-soft", name: "Softgel Extension Removal", price: 99 },
];

/* Default slot template — the usual weekly layout, used as a starting
   point. Owners can edit each day's slots freely (add/remove/relabel).
   Duplicate labels = two chairs running at the same time. */
export const DEFAULT_SLOT_LABELS = [
  "8am – 10am",
  "8am – 10am",
  "9am – 11am",
  "10am – 12nn",
  "10:30am",
  "1pm – 3pm",
  "1pm – 3pm",
  "2pm – 4pm",
  "3pm – 5pm",
  "3:30pm",
  "4pm – 6pm",
  "5pm – 7pm",
  "5:30pm",
  "6pm – 8pm",
  "7pm – 9pm",
];

/* A slot is "express" (single time, e.g. 9:30) if its label has no range dash.
   Works for both default and custom labels. */
export const isExpressLabel = (label) =>
  !/[–-]/.test(label || "");

/* Default slots as [{slot_idx, label, express}] */
export const DEFAULT_SLOTS = DEFAULT_SLOT_LABELS.map((label, i) => ({
  slot_idx: i,
  label,
  express: isExpressLabel(label),
}));

/* Back-compat alias (older code referenced SLOT_TEMPLATE) */
export const SLOT_TEMPLATE = DEFAULT_SLOTS;

/* Resolve the slots offered for a given day.
   daySlotsMap: { [dateKey]: [{slot_idx, label}] } from the day_slots table.
   Falls back to the default template when a day hasn't been customized. */
export function slotsForDay(dateKey, daySlotsMap) {
  const defs = daySlotsMap && daySlotsMap[dateKey];
  if (defs && defs.length) {
    return [...defs]
      .sort((a, b) => a.slot_idx - b.slot_idx)
      .map((s) => ({ slot_idx: s.slot_idx, label: s.label, express: isExpressLabel(s.label) }));
  }
  return DEFAULT_SLOTS;
}

/* Look up a single slot's label for a day (used for display). */
export function slotLabel(dateKey, slotIdx, daySlotsMap) {
  const list = slotsForDay(dateKey, daySlotsMap);
  const found = list.find((s) => s.slot_idx === slotIdx);
  return found ? found.label : `Slot ${slotIdx}`;
}

/* default: Mon/Tue/Wed promo, rest regular — mirrors the real post */
export const defaultPromo = (weekday) => weekday === 1 || weekday === 2 || weekday === 3;

export const peso = (n) => `₱${n}`;

/* Next 7 bookable days — no same-day booking, per studio policy */
export function getDays() {
  const days = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dow: d.toLocaleDateString("en-PH", { weekday: "short" }),
      dowLong: d.toLocaleDateString("en-PH", { weekday: "long" }),
      day: d.getDate(),
      month: d.toLocaleDateString("en-PH", { month: "short" }),
      monthLong: d.toLocaleDateString("en-PH", { month: "long" }),
      weekday: d.getDay(),
    });
  }
  return days;
}

export const serviceOptions = (promoDay) =>
  promoDay ? [PROMO_SERVICE, ...SERVICES, REMOVAL_ONLY] : [...SERVICES, REMOVAL_ONLY];

export const findService = (id, promoDay) =>
  serviceOptions(promoDay).find((s) => s.id === id);
