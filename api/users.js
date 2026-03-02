import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORIGIN_ALLOW = "https://teric-simons.github.io"; // match your GitHub Pages origin

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ORIGIN_ALLOW);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("id,name,is_active,security_question,created_at,updated_at") // ✅ add
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const users = (data || []).map((u) => ({
      id: u.id,
      name: u.name,
      security_question: u.security_question ?? null, // ✅ include
    }));

    return res.status(200).json({ users });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
