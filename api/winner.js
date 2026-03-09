// /api/winner.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORIGIN_ALLOW = "https://teric-simons.github.io";

function subtractDaysIso(timestamptzValue, days) {
  const d = new Date(timestamptzValue);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ORIGIN_ALLOW);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  try {
    // current cycle start (Fri 3pm Jamaica) – same rpc used in /api/leaderboard
    const { data: cycleRow, error: cycleErr } = await supabase.rpc(
      "current_cycle_start_jm"
    );
    if (cycleErr) return res.status(500).json({ error: cycleErr.message });

    const currentCycleStart = cycleRow; // timestamptz
    const previousCycleStart = subtractDaysIso(currentCycleStart, 7);

    // Winner from previous cycle
    const { data, error } = await supabase
      .from("song_choices")
      .select(
        "cycle_start,track_id,title,artist,album,cover_url,preview_url,link_url,votes,updated_at,created_at"
      )
      .eq("cycle_start", previousCycleStart)
      .order("votes", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) return res.status(500).json({ error: error.message });

    const row = (data || [])[0];

    if (!row) {
      return res.status(200).json({
        previousCycleStart,
        winner: null,
      });
    }

    // Optional: fetch fresh preview (mirrors /api/leaderboard behavior)
    let freshPreview = null;
    try {
      const dzRes = await fetch(`https://api.deezer.com/track/${row.track_id}`);
      const dzData = await dzRes.json();
      freshPreview = dzData?.preview || null;
    } catch {
      freshPreview = row.preview_url || null;
    }

    return res.status(200).json({
      previousCycleStart,
      winner: {
        id: row.track_id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        cover: row.cover_url,
        preview: freshPreview,
        link: row.link_url,
        votes: row.votes ?? 0,
        lastUpdatedAt: row.updated_at ?? row.created_at,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
