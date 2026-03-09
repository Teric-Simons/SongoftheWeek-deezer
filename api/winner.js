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
  res.setHeader("Access-Control-Allow-Origin", ORIGIN_ALLOW);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  try {
    const { data: currentCycleStart, error: cycleErr } = await supabase.rpc(
      "current_cycle_start_jm"
    );
    if (cycleErr) return res.status(500).json({ error: cycleErr.message });

    const previousCycleStart = subtractDaysIso(currentCycleStart, 7);

    const { data: topRows, error: topErr } = await supabase
      .from("song_choices")
      .select(
        "cycle_start,track_id,title,artist,album,cover_url,preview_url,link_url,votes,updated_at,created_at"
      )
      .eq("cycle_start", previousCycleStart)
      .order("votes", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);

    if (topErr) return res.status(500).json({ error: topErr.message });

    const top = (topRows || [])[0];
    if (!top) {
      return res.status(200).json({ previousCycleStart, winner: null });
    }

    // "pickedBy" = first user who chose the winning track in that cycle
    const { data: pickerRows, error: pickerErr } = await supabase
      .from("user_week_choice")
      .select("user_name,created_at")
      .eq("cycle_start", previousCycleStart)
      .eq("track_id", top.track_id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (pickerErr) return res.status(500).json({ error: pickerErr.message });

    const pickedBy = (pickerRows || [])[0]?.user_name ?? null;

    return res.status(200).json({
      previousCycleStart,
      winner: {
        pickedBy,
        id: top.track_id,
        title: top.title,
        artist: top.artist,
        album: top.album,
        cover: top.cover_url,
        preview: top.preview_url,
        link: top.link_url,
        votes: top.votes ?? 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
