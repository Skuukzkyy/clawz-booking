import { useState, useEffect, useCallback } from "react";
import { supabase, configured } from "./lib/supabase";
import { SLOT_TEMPLATE, getDays, defaultPromo, peso } from "./shared";

const tag = (b) =>
  b.service_id === "removal-only" ? " (r.o)" : b.removal ? " (r)" : "";

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
    const [bRes, cRes] = await Promise.all([
      supabase.from("bookings").select("*").in("date_key", keys).neq("status", "declined")
        .order("date_key").order("slot_idx"),
      supabase.from("day_config").select("*").in("date_key", keys),
    ]);
    if (!bRes.error) setBookings(bRes.data);
    if (!cRes.error) {
      const conf = {};
      for (const row of cRes.data) conf[row.date_key] = row.mode;
      setDayConf(conf);
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
