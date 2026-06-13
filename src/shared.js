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

/* Exact slot template from the real weekly FB post.
   Duplicate labels = two chairs running at the same time. */
export const SLOT_TEMPLATE = [
  { label: "8am – 10am" },
  { label: "8am – 10am" },
  { label: "9am – 11am" },
  { label: "10am – 12nn" },
  { label: "10:30am", express: true },
  { label: "1pm – 3pm" },
  { label: "1pm – 3pm" },
  { label: "2pm – 4pm" },
  { label: "3pm – 5pm" },
  { label: "3:30pm", express: true },
  { label: "4pm – 6pm" },
  { label: "5pm – 7pm" },
  { label: "5:30pm", express: true },
  { label: "6pm – 8pm" },
  { label: "7pm – 9pm" },
];

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
