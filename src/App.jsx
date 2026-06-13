import { useState, useEffect } from "react";
import Booking from "./Booking";
import Admin from "./Admin";

/* Hash routing keeps Cloudflare Pages config at zero:
   /        → client booking page
   /#/admin → owner dashboard (Supabase auth) */
export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route === "#/admin" ? <Admin /> : <Booking />;
}
