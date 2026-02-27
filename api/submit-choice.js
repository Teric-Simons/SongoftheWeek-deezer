import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORIGIN_ALLOW = "https://teric-simons.github.io"; // or "*" while testing

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN_ALLOW);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { chosenBy, track } = req.body || {};
    if (!chosenBy || !track?.id || !track?.title || !track?.artist) {
      return res.status(400).json({ error: "Missing chosenBy or track fields" });
    }

    const { data, error } = await supabase.rpc("vote_for_song", {
      p_track_id: track.id,
      p_title: track.title,
      p_artist: track.artist,
      p_album: track.album || null,
      p_cover_url: track.cover || null,
      p_preview_url: track.preview || null,
      p_chosen_by: chosenBy,
    });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, result: data?.[0] || null });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
