import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORIGIN_ALLOW = "https://teric-simons.github.io";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ORIGIN_ALLOW);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { userId, securityAnswer } = req.body || {};

    const id = typeof userId === "string" ? Number(userId) : userId;
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid userId" });

    const answer = (securityAnswer || "").trim();
    if (!answer) return res.status(400).json({ error: "Answer required" });

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, security_answer")
      .eq("id", id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!user) return res.status(404).json({ error: "User not found" });

    const stored = (user.security_answer || "").trim();

    // If not set, treat as first login (client should handle this, but safe here too)
    if (!stored) return res.status(409).json({ error: "Security answer not set yet" });

    const ok = stored.toLowerCase() === answer.toLowerCase(); // optional: case-insensitive match

    if (!ok) return res.status(401).json({ error: "Wrong security answer" });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
