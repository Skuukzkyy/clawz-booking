import { useState, useEffect, useCallback } from "react";
import { supabase, configured } from "./lib/supabase";
import { SLOT_TEMPLATE, getDays, defaultPromo, peso } from "./shared";

const tag = (b) =>
  b.service_id === "removal-only" ? " (r.o)" : b.removal ? " (r)" : "";

const firstNameOf = (b) => (b?.name || "").trim().split(/\s+/)[0] || "Client";

export default function Admin() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [days] = useState(getDays);
  const [bookings, setBookings] = useState([]);
  const [dayConf, setDayConf] = useState({});
  const [blocks, setBlocks] = useState({}); // `${dateKey}:${slotIdx}` -> block row
  const [manageDay, setManageDay] = useState(0); // which day's slots are being managed

  useEffect(() => {
    if (!configured) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!configured || !session) return;
    const keys = days.map((d) => d.key);
    const [bRes, cRes, blkRes] = await Promise.all([
      supabase.from("bookings").select("*").in("date_key", keys).neq("status", "declined")
        .order("date_key").order("slot_idx"),
      supabase.from("day_config").select("*").in("date_key", keys),
      supabase.from("slot_blocks").select("*").in("date_key", keys),
    ]);
    if (!bRes.error) setBookings(bRes.data);
    if (!cRes.error) {
      const conf = {};
      for (const row of cRes.data) conf[row.date_key] = row.mode;
      setDayConf(conf);
    }
    if (!blkRes.error) {
      const bk = {};
      for (const row of blkRes.data) bk[`${row.date_key}:${row.slot_idx}`] = row;
      setBlocks(bk);
    }
  }, [days, session]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const login = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoggingIn(false);
    if (error) setLoginErr("Wrong email or password.");
  };

  const isPromo = (d) =>
    dayConf[d.key] !== undefined ? dayConf[d.key] === "promo" : defaultPromo(d.weekday);

  const togglePromo = async (d) => {
    const mode = isPromo(d) ? "regular" : "promo";
    const { error } = await supabase.from("day_config").upsert({ date_key: d.key, mode });
    if (!error) setDayConf((c) => ({ ...c, [d.key]: mode }));
  };

  const setStatus = async (id, status) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (!error) refresh();
  };

  /* Destructive actions (decline / cancel) require confirmation
     so a single misclick can't drop a client's slot. */
  const confirmThenSet = (id, status, label) => {
    if (window.confirm(`${label}?\n\nThis frees the slot for other clients.`)) {
      setStatus(id, status);
    }
  };

  const dayMeta = (key) => days.find((d) => d.key === key);
  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  /* ── Slot blocking (day off / half day / time off) ── */
  const isBlocked = (dateKey, idx) => Boolean(blocks[`${dateKey}:${idx}`]);
  const bookingAt = (dateKey, idx) =>
    bookings.find((b) => b.date_key === dateKey && b.slot_idx === idx);

  const blockSlot = async (dateKey, idx) => {
    if (bookingAt(dateKey, idx)) return; // can't block a booked slot
    if (isBlocked(dateKey, idx)) return;
    const { error } = await supabase.from("slot_blocks").insert({ date_key: dateKey, slot_idx: idx });
    if (!error) refresh();
  };

  const unblockSlot = async (dateKey, idx) => {
    const row = blocks[`${dateKey}:${idx}`];
    if (!row) return;
    const { error } = await supabase.from("slot_blocks").delete().eq("id", row.id);
    if (!error) refresh();
  };

  const toggleBlock = (dateKey, idx) =>
    isBlocked(dateKey, idx) ? unblockSlot(dateKey, idx) : blockSlot(dateKey, idx);

  /* Bulk: block a set of slot indexes that aren't already booked */
  const blockMany = async (dateKey, idxs, label) => {
    const free = idxs.filter((i) => !bookingAt(dateKey, i) && !isBlocked(dateKey, i));
    if (free.length === 0) return;
    if (!window.confirm(`Close ${label}?\n\nClients won't be able to book these slots.`)) return;
    const rows = free.map((i) => ({ date_key: dateKey, slot_idx: i }));
    const { error } = await supabase.from("slot_blocks").insert(rows);
    if (!error) refresh();
  };

  const openAll = async (dateKey, idxs, label) => {
    const blocked = idxs.filter((i) => isBlocked(dateKey, i));
    if (blocked.length === 0) return;
    if (!window.confirm(`Re-open ${label}?`)) return;
    const ids = blocked.map((i) => blocks[`${dateKey}:${i}`].id);
    const { error } = await supabase.from("slot_blocks").delete().in("id", ids);
    if (!error) refresh();
  };

  const allIdx = SLOT_TEMPLATE.map((_, i) => i);
  // Morning = slots before the first "1pm" label; afternoon = the rest
  const firstAfternoon = SLOT_TEMPLATE.findIndex((s) => s.label.includes("1pm"));
  const morningIdx = allIdx.filter((i) => i < firstAfternoon);
  const afternoonIdx = allIdx.filter((i) => i >= firstAfternoon);

  if (!authReady) return <div className="app"><div className="empty">Loading…</div></div>;

  if (!configured) {
    return (
      <div className="app">
        <div className="configWarn">
          <strong>Setup needed:</strong> add <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> environment variables, then redeploy.
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <div className="loginBox">
          <div className="sectionTitle">Owner sign-in</div>
          <div className="sectionSub">Clawz By Nurin · staff only</div>
          <form onSubmit={login}>
            <div className="field">
              <label htmlFor="a-email">Email</label>
              <input id="a-email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="a-pass">Password</label>
              <input id="a-pass" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
            {loginErr && <div className="loginErr">{loginErr}</div>}
            <button className="btn" type="submit" disabled={!email || !password || loggingIn}>
              {loggingIn ? "Signing in…" : "Sign in"}
            </button>
            <button className="btnGhost" type="button" onClick={() => { window.location.hash = ""; }}>
              Back to booking page
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="ownerBar">
        <span>💅 Owner dashboard</span>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>

      <div className="dayHeader"><div className="sectionTitle">Promo days this week</div></div>
      <div className="sectionSub">Tap to switch a day between ₱299 promo and regular pricing.</div>
      {days.map((d) => (
        <div className="dayConfRow" key={d.key}>
          <span className="d">{d.dowLong}, {d.month} {d.day}</span>
          <button className={`toggle ${isPromo(d) ? "promo" : "regular"}`} onClick={() => togglePromo(d)}>
            {isPromo(d) ? "₱299 Promo" : "Regular"}
          </button>
        </div>
      ))}

      <div className="dayHeader" style={{ marginTop: 18 }}><div className="sectionTitle">Time off & availability</div></div>
      <div className="sectionSub">Close slots when you're off. Clients see them as “Unavailable.”</div>

      <div className="dayStrip" role="tablist" aria-label="Pick a day to manage">
        {days.map((d, i) => {
          const blockedCount = allIdx.filter((idx) => isBlocked(d.key, idx)).length;
          return (
            <button
              key={d.key}
              className={`dayChip ${i === manageDay ? "active" : ""}`}
              onClick={() => setManageDay(i)}
            >
              {blockedCount > 0 && <span className="promoDot" style={{ background: "#8A6B5C" }}>{blockedCount}</span>}
              <div className="dow">{d.dow}</div>
              <div className="num">{d.day}</div>
              <div className="mo">{d.month}</div>
            </button>
          );
        })}
      </div>

      {(() => {
        const d = days[manageDay];
        const allBlocked = allIdx.every((i) => isBlocked(d.key, i) || bookingAt(d.key, i));
        const morningBlocked = morningIdx.every((i) => isBlocked(d.key, i) || bookingAt(d.key, i));
        return (
          <>
            <div className="quickActions">
              {allBlocked
                ? <button className="qaBtn open" onClick={() => openAll(d.key, allIdx, "the whole day")}>Re-open whole day</button>
                : <button className="qaBtn" onClick={() => blockMany(d.key, allIdx, "the whole day")}>Close whole day</button>}
              {morningBlocked
                ? <button className="qaBtn open" onClick={() => openAll(d.key, morningIdx, "the morning")}>Re-open morning</button>
                : <button className="qaBtn" onClick={() => blockMany(d.key, morningIdx, "the morning (half day)")}>Close morning</button>}
            </div>
            <div className="slotList" style={{ marginTop: 4 }}>
              {SLOT_TEMPLATE.map((s, i) => {
                const booked = bookingAt(d.key, i);
                const blocked = isBlocked(d.key, i);
                return (
                  <div
                    key={i}
                    className={`manageSlot ${blocked ? "isBlocked" : ""} ${booked ? "isBooked" : ""}`}
                    onClick={() => !booked && toggleBlock(d.key, i)}
                  >
                    <div className="slotTime">
                      {s.label}
                      {s.express && <span className="expressTag">Express</span>}
                    </div>
                    {booked
                      ? <span className="manageState booked">Booked — {firstNameOf(booked)}</span>
                      : blocked
                        ? <span className="manageState blocked">Closed · tap to open</span>
                        : <span className="manageState open">Open · tap to close</span>}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      <div className="dayHeader" style={{ marginTop: 18 }}><div className="sectionTitle">Booking requests</div></div>
      <div className="sectionSub">Confirm or decline — clients see the result within seconds.</div>
      {pending.length === 0 && <div className="empty">No pending requests right now. 💅</div>}
      {pending.map((b) => {
        const d = dayMeta(b.date_key);
        return (
          <div className="ownerCard" key={b.id}>
            <div className="who">{b.name}{tag(b)}</div>
            <div className="meta">
              {d ? `${d.dowLong}, ${d.monthLong} ${d.day}` : b.date_key} · {SLOT_TEMPLATE[b.slot_idx]?.label}<br />
              📱 {b.phone}{b.fb ? ` · FB: ${b.fb}` : ""}
            </div>
            <div className="svc">
              {b.service}{b.service_id !== "removal-only" && b.service_id !== "promo" ? ` (${b.service_group})` : ""} — {peso(b.price)}
              {b.removal ? ` · ${b.removal} +${peso(b.removal_price)}` : ""}
              {b.note ? <><br />📝 {b.note}</> : null}
            </div>
            <div className="ownerActions">
              <button className="declineBtn" onClick={() => confirmThenSet(b.id, "declined", `Decline ${b.name}'s request`)}>Decline</button>
              <button className="confirmBtn" onClick={() => setStatus(b.id, "confirmed")}>Confirm slot</button>
            </div>
          </div>
        );
      })}

      <div className="dayHeader" style={{ marginTop: 18 }}><div className="sectionTitle">Confirmed this week</div></div>
      {confirmed.length === 0 && <div className="empty">Nothing confirmed yet.</div>}
      {confirmed.map((b) => {
        const d = dayMeta(b.date_key);
        return (
          <div className="ownerCard" key={b.id}>
            <div className="who">{b.name}{tag(b)}</div>
            <div className="meta">
              {d ? `${d.dowLong}, ${d.monthLong} ${d.day}` : b.date_key} · {SLOT_TEMPLATE[b.slot_idx]?.label} · 📱 {b.phone}
            </div>
            <div className="svc">
              {b.service} — {peso(b.price)}{b.removal ? ` · ${b.removal} +${peso(b.removal_price)}` : ""}
            </div>
            <span className="statusPill confirmed">Confirmed</span>
            <div className="ownerActions">
              <button className="declineBtn" onClick={() => confirmThenSet(b.id, "declined", `Cancel ${b.name}'s booking`)}>Cancel booking</button>
            </div>
          </div>
        );
      })}
      <div className="demoNote">Client contact details only appear here, behind sign-in — never publicly.</div>
    </div>
  );
}
