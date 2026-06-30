"use client";

import { useEffect, useRef, useState } from "react";

type RoundPhase = "BETTING" | "DRAWING" | "COMPLETED";

interface RoundUpdate {
  roundCode: string;
  phase: RoundPhase;
  secondsRemaining: number;
  drawnNumbers: number[];
  serverSeedHash: string;
  serverSeed?: string;
}

const KENO_WS_URL = process.env.NEXT_PUBLIC_KENO_WS_URL ?? "ws://localhost:8091";
const MAX_PICKS = 10;

export default function FastKenoBoard({ userId }: { userId: number }) {
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [round, setRound] = useState<RoundUpdate | null>(null);
  const [stake, setStake] = useState(100); // cents
  const [message, setMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(KENO_WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "ROUND_UPDATE") {
        const update: RoundUpdate = msg.data;
        setRound(update);
        if (update.phase === "COMPLETED") {
          setPicks(new Set()); // clear board for next round
        }
      }
    };

    return () => ws.close();
  }, []);

  function togglePick(n: number) {
    if (round?.phase !== "BETTING") return;
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < MAX_PICKS) next.add(n);
      return next;
    });
  }

  async function placeBet() {
    if (picks.size === 0) {
      setMessage("Pick at least 1 number");
      return;
    }
    setMessage(null);

    const res = await fetch("/api/keno/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, picks: Array.from(picks), stakeCents: stake }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error ?? "Bet failed");
    } else {
      setMessage(`Ticket placed: ${picks.size} picks, ${(stake / 100).toFixed(2)} stake`);
    }
  }

  const drawnSet = new Set(round?.drawnNumbers ?? []);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="text-lg font-semibold text-white">
        {round
          ? `Round ${round.roundCode} — ${round.phase} — ${round.secondsRemaining}s`
          : "Connecting to round..."}
      </div>

      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
          const isPicked = picks.has(n);
          const isDrawn = drawnSet.has(n);
          return (
            <button
              key={n}
              onClick={() => togglePick(n)}
              disabled={round?.phase !== "BETTING"}
              className={[
                "h-9 w-9 rounded-md text-xs font-medium transition-colors",
                isPicked && isDrawn && "bg-amber-500 text-black",
                isPicked && !isDrawn && "bg-blue-600 text-white",
                !isPicked && isDrawn && "bg-emerald-600 text-white",
                !isPicked && !isDrawn && "bg-slate-800 text-slate-300 hover:bg-slate-700",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-300">
          Stake ($)
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={stake / 100}
            onChange={(e) => setStake(Math.round(parseFloat(e.target.value) * 100))}
            className="ml-2 w-20 rounded bg-slate-800 px-2 py-1 text-white"
          />
        </label>
        <button
          onClick={placeBet}
          disabled={round?.phase !== "BETTING"}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          Place Bet
        </button>
        <button
          onClick={() => setPicks(new Set())}
          className="rounded bg-slate-700 px-4 py-2 text-white"
        >
          Clear
        </button>
      </div>

      {message && <div className="text-sm text-amber-400">{message}</div>}
    </div>
  );
}
