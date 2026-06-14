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

/* ── Time model ───────────────────────────────────────────────
   Slots are defined by start (required) and end (optional) minutes
   from midnight. The label is GENERATED, never typed, so input is
   always valid and consistently formatted. Slots sort by start time. */

/* Format minutes-from-midnight to a clean label piece, e.g. 480 -> "8am",
   570 -> "9:30am", 720 -> "12nn", 1080 -> "6pm". */
export function fmtTime(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  if (h24 === 12 && m === 0) return "12nn";
  if (h24 === 0 && m === 0) return "12mn";
  const ampm = h24 < 12 ? "am" : "pm";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, "0")}${ampm}`;
}

/* Build the display label from start/end minutes. */
export function makeLabel(startMin, endMin) {
  if (endMin == null) return fmtTime(startMin);
  return `${fmtTime(startMin)} – ${fmtTime(endMin)}`;
}

/* Default slot template as structured {start, end} (end null = single-time). */
export const DEFAULT_SLOT_TIMES = [
  { start: 8 * 60, end: 10 * 60 },     // 8am – 10am
  { start: 8 * 60, end: 10 * 60 },     // 8am – 10am (2nd chair)
  { start: 9 * 60, end: 11 * 60 },     // 9am – 11am
  { start: 10 * 60, end: 12 * 60 },    // 10am – 12nn
  { start: 10 * 60 + 30, end: null },  // 10:30am
  { start: 13 * 60, end: 15 * 60 },    // 1pm – 3pm
  { start: 13 * 60, end: 15 * 60 },    // 1pm – 3pm (2nd chair)
  { start: 14 * 60, end: 16 * 60 },    // 2pm – 4pm
  { start: 15 * 60, end: 17 * 60 },    // 3pm – 5pm
  { start: 15 * 60 + 30, end: null },  // 3:30pm
  { start: 16 * 60, end: 18 * 60 },    // 4pm – 6pm
  { start: 17 * 60, end: 19 * 60 },    // 5pm – 7pm
  { start: 17 * 60 + 30, end: null },  // 5:30pm
  { start: 18 * 60, end: 20 * 60 },    // 6pm – 8pm
  { start: 19 * 60, end: 21 * 60 },    // 7pm – 9pm
];

export const DEFAULT_SLOT_LABELS = DEFAULT_SLOT_TIMES.map((t) => makeLabel(t.start, t.end));

/* A slot is "express" (single time) when it has no end time. */
export const isExpress = (slot) => slot.end == null || slot.end === undefined;

/* Default slots as [{slot_idx, label, start, end, express}] */
export const DEFAULT_SLOTS = DEFAULT_SLOT_TIMES.map((t, i) => ({
  slot_idx: i,
  start_min: t.start,
  end_min: t.end,
  label: makeLabel(t.start, t.end),
  express: t.end == null,
}));

/* Back-compat alias */
export const SLOT_TEMPLATE = DEFAULT_SLOTS;

/* Resolve the slots offered for a given day, sorted chronologically by
   start time (then end time). daySlotsMap rows carry start_min/end_min/label.
   Falls back to the default template when a day hasn't been customized. */
export function slotsForDay(dateKey, daySlotsMap) {
  const defs = daySlotsMap && daySlotsMap[dateKey];
  if (defs && defs.length) {
    return [...defs]
      .sort((a, b) =>
        (a.start_min - b.start_min) ||
        ((a.end_min ?? a.start_min) - (b.end_min ?? b.start_min)) ||
        (a.slot_idx - b.slot_idx)
      )
      .map((s) => ({
        slot_idx: s.slot_idx,
        start_min: s.start_min,
        end_min: s.end_min,
        label: s.label || makeLabel(s.start_min, s.end_min),
        express: s.end_min == null,
      }));
  }
  return DEFAULT_SLOTS;
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

/* Time options for the slot-editor dropdowns: 6:00am … 10:00pm, 15-min steps. */
export const TIME_OPTIONS = (() => {
  const opts = [];
  for (let m = 6 * 60; m <= 22 * 60; m += 15) {
    opts.push({ value: m, label: fmtTime(m) });
  }
  return opts;
})();
