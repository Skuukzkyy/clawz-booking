import { useState, useEffect, useCallback } from "react";
import { supabase, configured } from "./lib/supabase";
import {
  REMOVALS, getDays, defaultPromo, peso,
  serviceOptions, findService, slotsForDay,
} from "./shared";

const firstName = (full) => (full || "").trim().split(/\s+/)[0] || "Client";

export default function Booking() {
  const [days] = useState(getDays);
  const [slots, setSlots] = useState({});      // `${dateKey}:${slotIdx}` -> {status, display_name, tag}
  const [dayConf, setDayConf] = useState({});  // dateKey -> 'promo' | 'regular'
  const [blocks, setBlocks] = useState(new Set()); // `${dateKey}:${slotIdx}` blocked by owner
  const [daySlots, setDaySlots] = useState({}); // dateKey -> [{slot_idx, label}]
  const [loaded, setLoaded] = useState(false);
  const [activeDay, setActiveDay] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);

  /* form state */
  const [fName, setFName] = useState("");
  const [fFb, setFFb] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fService, setFService] = useState("");
  const [fRemoval, setFRemoval] = useState("none");
  const [fNote, setFNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!configured) { setLoaded(true); return; }
    const keys = days.map((d) => d.key);
    const [slotRes, confRes, blockRes, dsRes] = await Promise.all([
      supabase.from("public_slots").select("*").in("date_key", keys),
      supabase.from("day_config").select("*").in("date_key", keys),
      supabase.from("public_blocks").select("*").in("date_key", keys),
      supabase.from("day_slots").select("*").in("date_key", keys),
    ]);
    if (!slotRes.error) {
      const map = {};
      for (const row of slotRes.data) map[`${row.date_key}:${row.slot_idx}`] = row;
      setSlots(map);
    }
    if (!confRes.error) {
      const conf = {};
      for (const row of confRes.data) conf[row.date_key] = row.mode;
      setDayConf(conf);
    }
    if (!blockRes.error) {
      const bset = new Set();
      for (const row of blockRes.data) bset.add(`${row.date_key}:${row.slot_idx}`);
      setBlocks(bset);
    }
    if (!dsRes.error) {
      const ds = {};
      for (const row of dsRes.data) {
        (ds[row.date_key] = ds[row.date_key] || []).push({ slot_idx: row.slot_idx, label: row.label, start_min: row.start_min, end_min: row.end_min });
      }
      setDaySlots(ds);
    }
    setLoaded(true);
  }, [days]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const isPromo = (d) =>
    dayConf[d.key] !== undefined ? dayConf[d.key] === "promo" : defaultPromo(d.weekday);

  const slotInfo = (dateKey, slotIdx) => slots[`${dateKey}:${slotIdx}`];

  const openSheet = (dateKey, slotIdx) => {
    const d = days.find((x) => x.key === dateKey);
    setSheet({ dateKey, slotIdx });
    setFName(""); setFFb(""); setFPhone("");
    setFService(isPromo(d) ? "promo" : "gp-plain");
    setFRemoval("none"); setFNote("");
  };

  const removalOnly = fService === "removal-only";
  const formValid = fName.trim() && fPhone.trim() && (!removalOnly || fRemoval !== "none");

  const total = () => {
    if (!sheet) return 0;
    const d = days.find((x) => x.key === sheet.dateKey);
    const svc = findService(fService, isPromo(d));
    const rmv = REMOVALS.find((r) => r.id === fRemoval);
    return (svc ? svc.price : 0) + (rmv ? rmv.price : 0);
  };

  const submitBooking = async () => {
    if (!formValid || !configured) return;
    setSubmitting(true);
    const d = days.find((x) => x.key === sheet.dateKey);
    const svc = findService(fService, isPromo(d));
    const rmv = REMOVALS.find((r) => r.id === fRemoval);
    const daySlotList = slotsForDay(sheet.dateKey, daySlots);
    const thisSlot = daySlotList.find((s) => s.slot_idx === sheet.slotIdx);
    const { error } = await supabase.from("bookings").insert({
      date_key: sheet.dateKey,
      slot_idx: sheet.slotIdx,
      slot_label: thisSlot ? thisSlot.label : null,
      name: fName.trim(),
      fb: fFb.trim() || null,
      phone: fPhone.trim(),
      service_id: svc.id,
      service: svc.name,
      service_group: svc.group,
      price: svc.price,
      removal: rmv.id === "none" ? null : rmv.name,
      removal_price: rmv.price,
      note: fNote.trim() || null,
      status: "pending",
    });
    setSubmitting(false);
    setSheet(null);
    if (error) {
      /* 23505 = unique_violation from one_active_booking_per_slot */
      if (error.code === "23505") {
        showToast("Oops — that slot was just taken. Pick another one!");
      } else {
        showToast("Couldn't save your booking. Please try again.");
      }
      refresh();
      return;
    }
    showToast("Slot requested! Wait for Nurin's confirmation 🍒");
    refresh();
  };

  const day = days[activeDay];
  const dayIsPromo = isPromo(day);
  const isBlocked = (dateKey, slotIdx) => blocks.has(`${dateKey}:${slotIdx}`);
  const daySlotList = slotsForDay(day.key, daySlots);
  const openCount = daySlotList.filter(
    (s) => !slotInfo(day.key, s.slot_idx) && !isBlocked(day.key, s.slot_idx)
  ).length;

  return (
    <div className="app">
      <div className="hero">
        <div className="logoRow">
          <span className="logo">CL<span className="bottle">♦</span>WZ</span>
          <span className="byline">by Nurin</span>
        </div>
        <div className="tagline">Casongsong, Guimba, Nueva Ecija · 0953-495-6565</div>
        <div className="heroBadge">🍒 Slots for next week‼️</div>
      </div>

      {!configured && (
        <div className="configWarn">
          <strong>Setup needed:</strong> add <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> environment variables, then redeploy.
        </div>
      )}

      <div className="dayStrip" role="tablist" aria-label="Pick a day">
        {days.map((d, i) => (
          <button
            key={d.key}
            role="tab"
            aria-selected={i === activeDay}
            className={`dayChip ${i === activeDay ? "active" : ""}`}
            onClick={() => setActiveDay(i)}
          >
            {isPromo(d) && <span className="promoDot">₱299</span>}
            <div className="dow">{d.dow}</div>
            <div className="num">{d.day}</div>
            <div className="mo">{d.month}</div>
          </button>
        ))}
      </div>

      <div className="dayHeader">
        <div className="sectionTitle">{day.dowLong}, {day.monthLong} {day.day}</div>
        {dayIsPromo ? (
          <div className="promoBanner promo">🍒 ₱299 PROMO SLOT DAY — fixed-price set, inspo on the page</div>
        ) : (
          <div className="promoBanner regular">Regular slot day — full price list applies</div>
        )}
      </div>
      <div className="sectionSub">
        {loaded ? `${openCount} of ${daySlotList.length} slots open. ` : ""}
        Tap an open slot to claim it — no more racing in the comments.
      </div>

      <div className="slotList">
        {!loaded && <div className="empty">Loading slots…</div>}
        {loaded && daySlotList.length === 0 && (
          <div className="empty">No slots open for this day.</div>
        )}
        {loaded && daySlotList.map((s) => {
          const i = s.slot_idx;
          const info = slotInfo(day.key, i);
          const blocked = isBlocked(day.key, i) && !info;
          const state = blocked ? "blocked" : !info ? "open" : info.status === "confirmed" ? "booked" : "pending";
          return (
            <div
              key={i}
              className={`slot ${state === "open" ? "open" : "taken"} ${state === "pending" ? "pendingSlot" : ""} ${state === "blocked" ? "blockedSlot" : ""}`}
              onClick={() => state === "open" && openSheet(day.key, i)}
              role={state === "open" ? "button" : undefined}
              tabIndex={state === "open" ? 0 : undefined}
              onKeyDown={(e) => state === "open" && e.key === "Enter" && openSheet(day.key, i)}
            >
              <div className="checkbox">{state === "booked" ? "x" : state === "pending" ? "•" : state === "blocked" ? "–" : ""}</div>
              <div className="slotTime">
                {s.label}
                {s.express && <span className="expressTag">Express</span>}
              </div>
              {state === "open" && <div className="slotState open">Available</div>}
              {state === "booked" && (
                <div className="slotState booked">
                  {firstName(info.display_name)}{info.tag ? ` (${info.tag})` : ""} ✓
                </div>
              )}
              {state === "pending" && <div className="slotState pend">On hold</div>}
              {state === "blocked" && <div className="slotState blockedState">Unavailable</div>}
            </div>
          );
        })}
      </div>

      <div className="policies">
        <h3>Before you book</h3>
        <ul>
          <li>No same-day booking — slots open from tomorrow onward.</li>
          <li>Slots are strictly non-transferable.</li>
          <li>Reschedule up to 48 hours before your appointment.</li>
          <li>15 mins late: ₱50 fee · 25 mins late: slot is cancelled.</li>
          <li>Nail sets may take 2–3 hours. One companion per client.</li>
          <li>One-week warranty on all sets.</li>
          <li>Promo days: ₱299 fixed-price set from the inspo post.</li>
        </ul>
      </div>

      <div className="demoNote">
        Your phone number is only ever visible to Nurin — never shown publicly.
      </div>

      {sheet && (() => {
        const d = days.find((x) => x.key === sheet.dateKey);
        const promoDay = isPromo(d);
        return (
          <div className="overlay" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
            <div className="sheet" role="dialog" aria-label="Book this slot">
              <div className="sheetTitle">Claim this slot</div>
              <div>
                <span className="sheetSlot">
                  {d.dowLong}, {d.monthLong} {d.day} · {slotsForDay(sheet.dateKey, daySlots).find((s) => s.slot_idx === sheet.slotIdx)?.label}
                </span>
                {promoDay && <span className="promoChip">₱299 PROMO DAY</span>}
              </div>

              <div className="field">
                <label htmlFor="f-name">Full name</label>
                <input id="f-name" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Juana Dela Cruz" />
              </div>
              <div className="field">
                <label htmlFor="f-phone">Mobile number</label>
                <input id="f-phone" type="tel" value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="09XX XXX XXXX" />
              </div>
              <div className="field">
                <label htmlFor="f-fb">Facebook name <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
                <input id="f-fb" value={fFb} onChange={(e) => setFFb(e.target.value)} placeholder="So Nurin can find you on Messenger" />
              </div>
              <div className="field">
                <label htmlFor="f-svc">Service</label>
                <select id="f-svc" value={fService} onChange={(e) => setFService(e.target.value)}>
                  {serviceOptions(promoDay).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id === "promo" || s.id === "removal-only" ? s.name : `${s.group} · ${s.name} — ${peso(s.price)}`}
                    </option>
                  ))}
                </select>
                {removalOnly && <div className="fieldHint">Pick which removal you need below.</div>}
              </div>
              <div className="field">
                <label htmlFor="f-rmv">{removalOnly ? "Removal service" : "Add removal?"}</label>
                <select id="f-rmv" value={fRemoval} onChange={(e) => setFRemoval(e.target.value)}>
                  {REMOVALS.filter((r) => !removalOnly || r.id !== "none").map((r) => (
                    <option key={r.id} value={r.id}>{r.name}{r.price ? ` — ${removalOnly ? "" : "+"}${peso(r.price)}` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-note">Notes <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
                <textarea id="f-note" rows={2} value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Design pegs, inspo, requests…" />
              </div>

              <div className="priceLine">
                <span className="lbl">Estimated total</span>
                <span className="amt">{peso(total())}</span>
              </div>

              <button className="btn" disabled={!formValid || submitting} onClick={submitBooking}>
                {submitting ? "Securing your slot…" : "Request this slot"}
              </button>
              <button className="btnGhost" onClick={() => setSheet(null)}>Never mind</button>

              <div className="policyNote">
                Your slot is held the moment you tap — no one else can claim it while Nurin reviews.
                Confirmation follows on Messenger. No same-day bookings · reschedule up to 48 hrs before.
              </div>
            </div>
          </div>
        );
      })()}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
