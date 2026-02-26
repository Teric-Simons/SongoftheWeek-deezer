import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-only secret
);

export default async function handler(req, res) {
  // CORS (so GitHub Pages can call this)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { chosenBy, track } = req.body || {};

    if (!chosenBy || !track?.id || !track?.title || !track?.artist) {
      return res.status(400).json({ error: "Missing chosenBy or track fields" });
    }

    const row = {
      track_id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || null,
      cover_url: track.cover || null,
      preview_url: track.preview || null,
      chosen_by: chosenBy,
    };

    const { error } = await supabase.from("song_choices").insert([row]);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
