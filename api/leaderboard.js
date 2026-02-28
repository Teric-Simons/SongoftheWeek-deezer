import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORIGIN_ALLOW = "https://teric-simons.github.io"; // or "*" while testing

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
  .from("song_choices")
  .select("track_id,title,artist,album,cover_url,preview_url,link_url,votes,voters")
  .eq("cycle_start", (await supabase.rpc("current_cycle_start_jm")).data)
  .order("votes", { ascending: false })
  .limit(50);

    if (error) return res.status(500).json({ error: error.message });

  // Fetch fresh preview URLs from Deezer
const items = await Promise.all(
  (data || []).map(async (r) => {
    let freshPreview = null;

    try {
      const dzRes = await fetch(`https://api.deezer.com/track/${r.track_id}`);
      const dzData = await dzRes.json();
      freshPreview = dzData?.preview || null;
    } catch (err) {
      // If Deezer fails, fallback to stored preview
      freshPreview = r.preview_url || null;
    }

    return {
      id: r.track_id,
      title: r.title,
      artist: r.artist,
      album: r.album,
      cover: r.cover_url,
      preview: freshPreview, // ✅ use fresh signed URL
      votes: r.votes ?? 0,
      voters: r.voters ?? [],
      link: r.link_url,
      lastUpdatedAt: r.updated_at ?? r.created_at,
    };
  })
);

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
