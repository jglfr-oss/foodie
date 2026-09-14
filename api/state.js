// Shared household state, stored in Supabase table foodie_kv (key text primary key, value jsonb, updated_at timestamptz)
export default async function handler(req, res) {
  const pass = process.env.FOODIE_PASSCODE || "";
  if (pass && (req.headers["x-foodie-pass"] || "") !== pass) return res.status(401).json({ error: "bad passcode" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).send("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in Vercel env vars");
  const H = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  try {
    if (req.method === "GET") {
      const k = String(req.query.key || "");
      const r = await fetch(`${url}/rest/v1/foodie_kv?key=eq.${encodeURIComponent(k)}&select=value,updated_at`, { headers: H });
      if (!r.ok) return res.status(500).send(await r.text());
      const rows = await r.json();
      return res.status(200).json(rows[0] || { value: null });
    }
    if (req.method === "PUT") {
      const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
      const r = await fetch(`${url}/rest/v1/foodie_kv?on_conflict=key`, {
        method: "POST",
        headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: body.key, value: body.value, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return res.status(500).send(await r.text());
      return res.status(200).json({ ok: true });
    }
    res.status(405).send("GET or PUT");
  } catch (e) { res.status(500).send(String(e.message || e)); }
}
