// Receives raw receipt text (from the Apps Script or anything else), extracts items with Claude,
// and merges them into the shared Foodie state in Supabase.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");
  const pass = process.env.FOODIE_PASSCODE || "";
  if (pass && (req.headers["x-foodie-pass"] || "") !== pass) return res.status(401).send("bad passcode");
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, ANTHROPIC_API_KEY: akey } = process.env;
  if (!url || !key || !akey) return res.status(500).send("Missing env vars");
  const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  const text = String(body.text || "").slice(0, 12000), store = body.store || "Giant", hint = body.date || "";
  if (!text) return res.status(400).send("no text");
  try {
    // 1) Claude extracts line items
    const cr = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": akey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, system: "Respond with JSON only.",
        messages: [{ role: "user", content: `Extract purchased grocery items from this ${store} receipt. Normalize to plain product names. Skip tax, totals, coupons, "BONUS BUY"/savings lines, bags. Use the receipt's own date (look near the "Store #" line); fall back to ${hint || "today"}. Prices are line totals. JSON: {"date":"YYYY-MM-DD","items":[{"name":"","qty":1,"price":0}]}\n\n${text}` }] }),
    });
    const cj = await cr.json();
    if (cj.error) return res.status(502).send(cj.error.message);
    const raw = (cj.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").replace(/```json|```/g, "").trim();
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(j.date || "") ? j.date : (hint || new Date().toISOString().slice(0, 10));
    // 2) merge into state
    const H = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
    const sr = await fetch(`${url}/rest/v1/foodie_kv?key=eq.foodie%3Astate&select=value`, { headers: H });
    const rows = await sr.json();
    const S = (rows[0] && rows[0].value) || {};
    S.purchases = S.purchases || [];
    const seen = new Set(S.purchases.map(p => p.date + "|" + String(p.name).toLowerCase() + "|" + p.store));
    let added = 0;
    (j.items || []).forEach(it => {
      const name = String(it.name || "").trim(); if (!name) return;
      const k = date + "|" + name.toLowerCase() + "|" + store; if (seen.has(k)) return; seen.add(k);
      S.purchases.push({ name, store, date, qty: Math.max(1, +it.qty || 1), price: +it.price || 0, src: "email" }); added++;
    });
    S.lastSync = S.lastSync && S.lastSync > date ? S.lastSync : date;
    const wr = await fetch(`${url}/rest/v1/foodie_kv?on_conflict=key`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: "foodie:state", value: S, updated_at: new Date().toISOString() }) });
    if (!wr.ok) return res.status(500).send(await wr.text());
    res.status(200).json({ ok: true, date, added, found: (j.items || []).length });
  } catch (e) { res.status(500).send(String(e.message || e)); }
}
