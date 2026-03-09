// ==============================
// /api/winner.js  (NEW FILE)
// ==============================
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

// ==============================
// /src/Welcome.js  (MINIMAL CHANGES)
// ==============================
import { useMemo, useState, useEffect, useRef } from "react";
import "./Welcome.css";
import Leaderboard from "./Leaderboard.js";
import WeeklyResetTimer from "./WeeklyResetTimer";

const API_BASE = "https://songofthe-week-deezer.vercel.app";
const DEEZER_PROXY =
  "https://songofthe-week-deezer-7u29iwb95-teric-simons-projects.vercel.app/api/deezer-search";

function WinnerModal({ winner, onClose }) {
  return (
    <div className="winner-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="winner-modal" onClick={(e) => e.stopPropagation()}>
        {winner?.cover ? (
          <img className="winner-cover" src={winner.cover} alt={`${winner.title} cover`} />
        ) : (
          <div className="winner-cover placeholder" />
        )}

        <h3 style={{ marginTop: 12 }}>
          {winner ? "Congratulations!" : "New week started!"}
        </h3>

        <p style={{ marginTop: 8 }}>
          {winner
            ? `Congratulations ${winner.pickedBy ?? "someone"} won Song of the Week with "${winner.title}" by ${winner.artist} with ${Number(
                winner.votes ?? 0
              )} votes.`
            : "No songs were on the board for the previous cycle."}
        </p>

        <button style={{ marginTop: 14 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function WelcomePage({ name, onBack }) {
  const [songSelected, setSongSelected] = useState("");
  const skipNextSearch = useRef(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const [openSuggest, setOpenSuggest] = useState(false);

  const [leaderboardItems, setLeaderboardItems] = useState([]);

  const [leaderboardInitialLoading, setLeaderboardInitialLoading] = useState(true);
  const hasLoadedLeaderboardOnce = useRef(false);

  const [voteLoadingId, setVoteLoadingId] = useState(null);
  const isVoting = voteLoadingId !== null;

  // ✅ NEW: winner modal state
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [winnerData, setWinnerData] = useState(null);

  const userInfo = useMemo(() => {
    return { name, songSelected };
  }, [name, songSelected]);

  async function fetchLeaderboard({ initial = false } = {}) {
    const shouldShowInitialLoading = initial && !hasLoadedLeaderboardOnce.current;

    const minDelay = shouldShowInitialLoading
      ? new Promise((r) => setTimeout(r, 350))
      : Promise.resolve();

    if (shouldShowInitialLoading) setLeaderboardInitialLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      const data = await res.json();

      if (res.ok) {
        setLeaderboardItems(data.items || []);
        hasLoadedLeaderboardOnce.current = true;
      }
    } finally {
      await minDelay;
      if (shouldShowInitialLoading) setLeaderboardInitialLoading(false);
    }
  }

  // ✅ IMPORTANT: you currently had this twice — keep ONE
  useEffect(() => {
    fetchLeaderboard({ initial: true });
  }, []);

  // ✅ NEW: backend winner fetch
  async function fetchWinner() {
    const res = await fetch(`${API_BASE}/api/winner`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to fetch winner");
    return data?.winner ?? null;
  }

  // ✅ NEW: called by WeeklyResetTimer
  async function handleWeeklyReset() {
    try {
      const winner = await fetchWinner();
      setWinnerData(winner);
    } catch {
      setWinnerData(null);
    } finally {
      setWinnerModalOpen(true);
      fetchLeaderboard({ initial: false }).catch(() => {});
    }
  }

  function closeWinnerModal() {
    setWinnerModalOpen(false);
    setWinnerData(null);
  }

  async function handleVote(song, mode) {
    if (!song?.id) return;

    const user = userInfo?.name;
    if (!user) return;

    if (isVoting) return;

    setLeaderboardItems((prev) => {
      if (!Array.isArray(prev)) return prev;

      return prev.map((it) => {
        if (it.id !== song.id) return it;

        const voters = Array.isArray(it.voters) ? it.voters : [];
        const hasVoted = voters.includes(user);

        let nextHasVoted;
        if (mode === "vote") nextHasVoted = true;
        else if (mode === "unvote") nextHasVoted = false;
        else nextHasVoted = !hasVoted;

        const nextVoters = nextHasVoted
          ? Array.from(new Set([...voters, user]))
          : voters.filter((v) => v !== user);

        const currentVotes = typeof it.votes === "number" ? it.votes : voters.length;
        const nextVotes = Math.max(0, currentVotes + (nextHasVoted ? 1 : -1));

        return { ...it, voters: nextVoters, votes: nextVotes };
      });
    });

    try {
      setVoteLoadingId(song.id);
      setErrorMsg("");

      const res = await fetch(`${API_BASE}/api/submit-choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chosenBy: user,
          action: "toggle",
          mode,
          forceReplace: false,
          track: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            cover: song.cover,
            preview: song.preview,
            link: song.link,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error || "Vote failed.";

        if (res.status === 409 && typeof msg === "string" && msg.startsWith("CONFIRM_REPLACE:")) {
          const ok = window.confirm(
            "You already chose a song this week.\n\nReplace it with this new song? Your previous song will lose your vote."
          );

          if (!ok) {
            await fetchLeaderboard();
            return;
          }

          const res2 = await fetch(`${API_BASE}/api/submit-choice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chosenBy: user,
              action: "toggle",
              mode,
              forceReplace: true,
              track: {
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                cover: song.cover,
                preview: song.preview,
                link: song.link,
              },
            }),
          });

          const data2 = await res2.json();
          if (!res2.ok) throw new Error(data2?.error || "Replace failed.");

          await fetchLeaderboard();
          return;
        }

        throw new Error(msg);
      }

      fetchLeaderboard();
    } catch (e) {
      setErrorMsg(e?.message || "Could not vote.");
      await fetchLeaderboard();
    } finally {
      setVoteLoadingId(null);
    }
  }

  function togglePreview() {
    if (!selectedTrack?.preview) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(selectedTrack.preview);
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
        audioRef.current.currentTime = 0;
      });
    }

    if (audioRef.current.src !== selectedTrack.preview) {
      audioRef.current.pause();
      audioRef.current.src = selectedTrack.preview;
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
        setErrorMsg("Preview couldn't play (browser blocked it). Try clicking Play again.");
      });
    }
  }

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const q = songSelected.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpenSuggest(false);
      setErrorMsg("");
      return;
    }

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const url = `${DEEZER_PROXY}?` + new URLSearchParams({ q });
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Deezer search failed (${res.status})`);

        const data = await res.json();
        const tracks = data?.data ?? [];

        const items = tracks.slice(0, 700).map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist?.name || "",
          album: t.album?.title || "",
          cover: t.album?.cover_small || t.album?.cover || "",
          preview: t.preview || "",
          link: t.link || "",
        }));

        setSuggestions(items);
        setOpenSuggest(true);
      } catch {
        setSuggestions([]);
        setOpenSuggest(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [songSelected]);

  async function handleChoose() {
    if (!selectedTrack) {
      setErrorMsg("Pick a song from the suggestions first.");
      return;
    }

    if (isVoting) return;

    setLoading(true);
    setErrorMsg("");

    async function safeParse(res) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          return await res.json();
        } catch {
          return null;
        }
      }
      try {
        const txt = await res.text();
        return { error: txt };
      } catch {
        return null;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/submit-choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chosenBy: userInfo.name,
          action: "choose",
          track: selectedTrack,
          forceReplace: false,
        }),
      });

      const data = await safeParse(res);
      const msg = data?.error || "Failed to save.";

      if (!res.ok) {
        if (res.status === 409 && typeof msg === "string" && msg.startsWith("CONFIRM_REPLACE:")) {
          const ok = window.confirm(
            "You already chose a song this week.\n\nReplace it with this new song? (Your previous song will be replaced.)"
          );
          if (!ok) return;

          const res2 = await fetch(`${API_BASE}/api/submit-choice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chosenBy: userInfo.name,
              action: "choose",
              track: selectedTrack,
              forceReplace: true,
            }),
          });

          const data2 = await safeParse(res2);
          if (!res2.ok) throw new Error(data2?.error || "Replace failed.");

          await fetchLeaderboard();
          return;
        }

        throw new Error(msg);
      }

      await fetchLeaderboard();
    } catch (e) {
      setErrorMsg(e?.message || "Could not save. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="welcome-page-container">
      <div className="welcome-page">
        <header className="app-header">
          <div className="header-inner">
            <div className="welcomeback">
              <h3>
                Welcome back <span>{userInfo.name}</span> 👋
              </h3>
            </div>

            <div className="header-right">
              {/* ✅ ONLY CHANGE HERE: pass onReset */}
              <WeeklyResetTimer onReset={handleWeeklyReset} />
              <button className="signout-btn" onClick={onBack}>
                sign out
              </button>
            </div>
          </div>
        </header>

        {/* ✅ NEW: modal render (doesn't change your layout) */}
        {winnerModalOpen && <WinnerModal winner={winnerData} onClose={closeWinnerModal} />}

        <main className="choose">
          <h1>Song of the Week</h1>
          <p>Discover new vibes. Share your favorite tracks. Vote the best to the top.</p>

          <div className="song-input-con">
            <div className="typeahead">
              <input
                className="song-input"
                value={songSelected}
                onChange={(e) => setSongSelected(e.target.value)}
                placeholder="Enter your song of the week!"
                onFocus={() => suggestions.length && setOpenSuggest(true)}
                onBlur={() => setTimeout(() => setOpenSuggest(false), 150)}
              />

              {openSuggest && suggestions.length > 0 && (
                <div className="typeahead-menu">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      className="typeahead-item"
                      onMouseDown={() => {
                        skipNextSearch.current = true;

                        setSelectedTrack(s);
                        setSongSelected(`${s.title} — ${s.artist}`);

                        setOpenSuggest(false);
                        setErrorMsg("");

                        if (audioRef.current) {
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                        }
                        setIsPlaying(false);
                      }}
                    >
                      <img className="typeahead-cover" src={s.cover} alt="" />
                      <div className="typeahead-text">
                        <div className="typeahead-title">{s.title}</div>
                        <div className="typeahead-sub">
                          {s.artist}
                          {s.album ? ` • ${s.album}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="confirm" onClick={handleChoose} disabled={loading}>
              Choose
            </button>
          </div>

          {selectedTrack && (
            <div className="selected-track">
              <img className="selected-cover" src={selectedTrack.cover} alt="" />

              <div className="selected-meta">
                <div className="selected-title">{selectedTrack.title}</div>
                <div className="selected-sub">
                  {selectedTrack.artist}
                  {selectedTrack.album ? ` • ${selectedTrack.album}` : ""}
                </div>

                {!selectedTrack.preview && (
                  <div className="selected-note">No preview available for this track.</div>
                )}
              </div>

              <button
                className="preview-btn"
                onClick={togglePreview}
                disabled={!selectedTrack.preview}
                title={selectedTrack.preview ? "Play 30s preview" : "Preview unavailable"}
              >
                {isPlaying ? "Pause" : "Play Preview"}
              </button>
            </div>
          )}
        </main>

        <Leaderboard
          items={leaderboardItems}
          onVote={handleVote}
          currentUser={userInfo.name}
          voteLoadingId={voteLoadingId}
          disableAllVotes={isVoting}
          isLoading={leaderboardInitialLoading}
        />
      </div>
    </div>
  );
}

export default WelcomePage;

/*
NOTE:
Add these styles to your Welcome.css (if you don't already have them):

.winner-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px; }
.winner-modal { width:100%; max-width:380px; background:#111; color:#fff; border-radius:14px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,0.4); text-align:center; }
.winner-cover { width:100%; height:260px; object-fit:cover; border-radius:12px; }
.winner-cover.placeholder { width:100%; height:260px; border-radius:12px; background: rgba(255,255,255,0.08); }
*/
