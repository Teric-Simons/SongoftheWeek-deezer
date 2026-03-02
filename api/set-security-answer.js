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

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const answer = (securityAnswer || "").trim();
    if (!answer) return res.status(400).json({ error: "Security answer cannot be empty" });
    if (answer.length < 2) return res.status(400).json({ error: "Security answer is too short" });

    // ✅ Only set if currently NULL or empty (prevents overwriting)
    const { data, error } = await supabase
      .from("app_users")
      .update({ security_answer: answer })
      .eq("id", userId)
      .or("security_answer.is.null,security_answer.eq.") // null OR empty string
      .select("id,name,security_answer")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (!data) {
      return res.status(409).json({ error: "Security answer already set for this user." });
    }

    return res.status(200).json({ user: data });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
