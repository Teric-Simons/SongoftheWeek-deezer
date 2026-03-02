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
    const { userId, securityQuestion } = req.body || {};

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const q = (securityQuestion || "").trim();
    if (!q) return res.status(400).json({ error: "Security question cannot be empty" });
    if (q.length < 8) return res.status(400).json({ error: "Security question is too short" });

    // ✅ Only set if currently NULL or empty (prevents overwriting once set)
    const { data, error } = await supabase
      .from("app_users")
      .update({ security_question: q })
      .eq("id", userId)
      .or("security_question.is.null,security_question.eq.") // null OR empty string
      .select("id,name,security_question")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // If no row returned, it likely means it was already set and the .or condition didn't match.
    if (!data) {
      return res.status(409).json({ error: "Security question already set for this user." });
    }

    return res.status(200).json({ user: data });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
