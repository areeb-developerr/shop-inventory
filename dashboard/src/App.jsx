import React, { useEffect, useState } from "react";
import { supabase, fmt } from "./lib/supabase.js";

function Card({ label, value, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const login = async (e) => {
    e.preventDefault();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
  };

  const load = async () => {
    if (!supabase) return setError("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
    try {
      const [accounts, customers, suppliers, invoices, reportRows] = await Promise.all([
        supabase.from("accounts").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("suppliers").select("*"),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("daily_reports").select("date, generated_at, summary_json").order("date", { ascending: false }).limit(10),
      ]);
      const cash = (accounts.data || []).filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0);
      const bank = (accounts.data || []).filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0);
      const receivable = (customers.data || []).reduce((s, c) => s + c.balance, 0);
      const payable = (suppliers.data || []).reduce((s, s2) => s + s2.balance, 0);
      const today = new Date().toISOString().slice(0, 10);
      const todaySales = (invoices.data || []).filter((i) => i.date === today).reduce((s, i) => s + i.subtotal, 0);
      setData({ cash, bank, receivable, payable, todaySales, invoices: invoices.data || [] });
      setReports(reportRows.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (session) load();
  }, [session]);

  if (!supabase) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Shop Ledger Dashboard</h1>
        <p>Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in dashboard/.env</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "system-ui" }}>
        <form onSubmit={login} style={{ background: "#fff", padding: 32, borderRadius: 12, width: 360, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <h1 style={{ margin: "0 0 8px" }}>Shop Ledger</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>Remote dashboard — read only</p>
          {error && <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 12, borderRadius: 8, border: "1px solid #cbd5e1" }} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 16, borderRadius: 8, border: "1px solid #cbd5e1" }} required />
          <button type="submit" style={{ width: "100%", padding: 12, background: "#059669", color: "#fff", border: 0, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>Shop Ledger — Home View</h1>
          <button onClick={() => supabase.auth.signOut()} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Logout</button>
        </div>

        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              <Card label="Cash + Bank" value={fmt(data.cash + data.bank)} />
              <Card label="Customer Udhar" value={fmt(data.receivable)} sub="To collect" />
              <Card label="Supplier Payable" value={fmt(data.payable)} sub="To pay" />
              <Card label="Today's Sales" value={fmt(data.todaySales)} />
            </div>

            <h2>Recent Invoices</h2>
            <table style={{ width: "100%", background: "#fff", borderRadius: 12, borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: 12 }}>Invoice</th>
                  <th style={{ padding: 12 }}>Date</th>
                  <th style={{ padding: 12 }}>Total</th>
                  <th style={{ padding: 12 }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 12 }}>{i.invoice_no}</td>
                    <td style={{ padding: 12 }}>{i.date}</td>
                    <td style={{ padding: 12 }}>{fmt(i.subtotal)}</td>
                    <td style={{ padding: 12 }}>{i.payment_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>Daily Reports</h2>
            <ul style={{ background: "#fff", borderRadius: 12, padding: 16, listStyle: "none" }}>
              {reports.map((r) => (
                <li key={r.date} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  {r.date} — generated {new Date(r.generated_at).toLocaleString()}
                </li>
              ))}
              {!reports.length && <li style={{ color: "#94a3b8" }}>No reports synced yet</li>}
            </ul>
          </>
        )}

        <button onClick={load} style={{ marginTop: 16, padding: "10px 20px", background: "#059669", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer" }}>Refresh</button>
      </div>
    </div>
  );
}
