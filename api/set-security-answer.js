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

    // ✅ your id column is int8/bigint -> coerce carefully
    const id = typeof userId === "string" ? Number(userId) : userId;
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid userId", got: userId });
    }

    const answer = (securityAnswer || "").trim();
    if (!answer) return res.status(400).json({ error: "Security answer cannot be empty" });

    // 1) READ current row
    const { data: existing, error: readErr } = await supabase
      .from("app_users")
      .select("id, name, security_answer")
      .eq("id", id)
      .maybeSingle();

    if (readErr) return res.status(500).json({ error: readErr.message });
    if (!existing) return res.status(404).json({ error: "User not found", id });

    const alreadySet =
      existing.security_answer != null && String(existing.security_answer).trim() !== "";

    if (alreadySet) {
      return res.status(409).json({
        error: "Security answer already set for this user.",
        id,
        current: existing.security_answer,
      });
    }

    // 2) UPDATE
    const { data: updated, error: updErr } = await supabase
      .from("app_users")
      .update({ security_answer: answer })
      .eq("id", id)
      .select("id, name, security_answer")
      .maybeSingle();

    if (updErr) return res.status(500).json({ error: updErr.message });
    if (!updated) return res.status(500).json({ error: "Update failed (no row returned)", id });

    return res.status(200).json({ user: updated });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
