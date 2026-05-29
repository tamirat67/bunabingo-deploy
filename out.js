"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b ||= {})
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
"use client";
import { useEffect, useState, useRef, Suspense, useCallback, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getGame, getMyCard, claimBingo } from "../../lib/api";
import { useSocket } from "../../context/SocketContext";
import BunaModal from "../../components/BunaModal";
import { Volume2, VolumeX, RefreshCw, LogOut, Plus, X, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
const COL_COLOR = {
  B: "#E74C3C",
  I: "#E67E22",
  N: "#D4AF37",
  G: "#27AE60",
  O: "#8E44AD"
};
const COL_RANGES = [
  { l: "B", s: 1, e: 15 },
  { l: "I", s: 16, e: 30 },
  { l: "N", s: 31, e: 45 },
  { l: "G", s: 46, e: 60 },
  { l: "O", s: 61, e: 75 }
];
function colLabel(n) {
  if (n <= 15)
    return "B";
  if (n <= 30)
    return "I";
  if (n <= 45)
    return "N";
  if (n <= 60)
    return "G";
  return "O";
}
function GameContent() {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const router = useRouter();
  const { T, activeThemeKey } = useTheme();
  const sp = useSearchParams();
  const gameId = sp.get("id");
  const { socket } = useSocket();
  const [game, setGame] = useState(null);
  const [tickets, setTickets] = useState([]);
  useEffect(() => {
    if (typeof window !== "undefined" && gameId) {
      try {
        const cached = sessionStorage.getItem(`game_tickets_${gameId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setTickets(parsed.sort((a, b) => {
            var _a2, _b2;
            return (((_a2 = a.card) == null ? void 0 : _a2.id) || 0) - (((_b2 = b.card) == null ? void 0 : _b2.id) || 0);
          }));
        }
      } catch (e) {
      }
    }
  }, [gameId]);
  const spType = sp.get("type") || "";
  const spPrice = sp.get("price");
  const isDemo = game ? ((_a = game == null ? void 0 : game.room) == null ? void 0 : _a.type) === "DEMO" : spType === "DEMO";
  const isSpin = game ? (_c = (_b = game == null ? void 0 : game.room) == null ? void 0 : _b.type) == null ? void 0 : _c.startsWith("SPIN_") : spType.startsWith("SPIN_");
  const stake = game ? isDemo ? 0 : Number(((_d = game == null ? void 0 : game.room) == null ? void 0 : _d.ticketPrice) || 10) : spPrice ? Number(spPrice) : 10;
  const isVip = game ? ((_e = game == null ? void 0 : game.room) == null ? void 0 : _e.type) === "VIP" || ((_f = game == null ? void 0 : game.room) == null ? void 0 : _f.type) === "JACKPOT" || stake >= 100 : spType === "VIP" || spType === "JACKPOT" || stake >= 100;
  const fabBg = isVip ? "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #C471ED 100%)" : "radial-gradient(circle at 35% 35%, #34c759 0%, #248a3d 70%, #155224 130%)";
  const fabBorder = isVip ? "#FFD700" : "#155224";
  const fabInnerRing = isVip ? "rgba(255, 255, 255, 0.6)" : "#34c75988";
  const fabPlusColor = isVip ? "#1C0A35" : "#ffffff";
  const [drawn, setDrawn] = useState([]);
  const [lastBall, setLastBall] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [hidden, setHidden] = useState(/* @__PURE__ */ new Set());
  const [winMsg, setWinMsg] = useState(null);
  const [gameFinished, setGameFinished] = useState(null);
  const [redirectSecs, setRedirectSecs] = useState(5);
  const redirectTimerRef = useRef(null);
  const redirectCountdownRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [serverOff, setServerOff] = useState(0);
  const [marked, setMarked] = useState(/* @__PURE__ */ new Set());
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [calledHistory, setCalledHistory] = useState([]);
  const toastTimer = useRef(null);
  const lastStartAudioPlayed = useRef(0);
  const soundOnRef = useRef(true);
  const lastDrawnRef = useRef(0);
  const audioQueueRef = useRef([]);
  const isPlayingQueueRef = useRef(false);
  const isFirstLoadRef = useRef(true);
  const ticketsRef = useRef([]);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);
  const ballAudioRef = useRef(null);
  useEffect(() => {
    if (typeof window !== "undefined" && !ballAudioRef.current) {
      ballAudioRef.current = new Audio();
    }
  }, []);
  const playBallSound = useCallback((num) => {
    if (!soundOnRef.current)
      return;
    const col = colLabel(num);
    try {
      const el = ballAudioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
        el.src = `/audio/${col}${num}.mp3`;
        el.play().catch(() => {
          try {
            new Audio(`/audio/${col}${num}.mp3`).play().catch(() => {
            });
          } catch (_) {
          }
        });
      } else {
        new Audio(`/audio/${col}${num}.mp3`).play().catch(() => {
        });
      }
    } catch (e) {
    }
  }, []);
  const processAudioQueue = useCallback((setLastBallFn) => {
    if (audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      return;
    }
    isPlayingQueueRef.current = true;
    const nextBall = audioQueueRef.current.shift();
    if (nextBall) {
      lastDrawnRef.current = nextBall;
      setLastBallFn(nextBall);
      setCalledHistory((prev) => prev.includes(nextBall) ? prev : [...prev, nextBall]);
      playBallSound(nextBall);
      setTimeout(() => {
        processAudioQueue(setLastBallFn);
      }, 1800);
    } else {
      isPlayingQueueRef.current = false;
    }
  }, [playBallSound]);
  const queueBallSounds = useCallback((numbers, setLastBallFn) => {
    const currentQueue = audioQueueRef.current;
    const toAdd = numbers.filter((n) => !currentQueue.includes(n) && n !== lastDrawnRef.current);
    if (toAdd.length === 0)
      return;
    audioQueueRef.current = [...currentQueue, ...toAdd];
    if (!isPlayingQueueRef.current) {
      processAudioQueue(setLastBallFn);
    }
  }, [processAudioQueue]);
  const playStartAudio = useCallback(() => {
    if (!soundOnRef.current)
      return;
    const now = Date.now();
    if (now - lastStartAudioPlayed.current < 2500)
      return;
    lastStartAudioPlayed.current = now;
    try {
      new Audio("/audio/start.mp3").play().catch(() => {
      });
    } catch (e) {
    }
  }, []);
  const playStopAudio = useCallback(() => {
    if (!soundOnRef.current)
      return;
    try {
      new Audio("/audio/stop.mp3").play().catch(() => {
      });
    } catch (e) {
    }
  }, []);
  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });
  const showAlert = (title, message, type = "info") => {
    setModal({ isOpen: true, title, message, type });
  };
  const loadData = useCallback(() => {
    if (!gameId)
      return;
    Promise.all([
      getGame(gameId),
      getMyCard(gameId).catch(() => ({ tickets: [] }))
    ]).then(([g, t]) => {
      setGame(g);
      try {
        sessionStorage.setItem(`game_state_${gameId}`, JSON.stringify({
          status: g.status,
          totalPrize: g.totalPrize,
          room: g.room,
          drawHistory: g.drawHistory,
          currentPlayers: g.currentPlayers
        }));
      } catch (e) {
      }
      if (g.status === "RUNNING" || g.status === "FINISHED") {
        setCountdown(null);
        setEndTime(null);
      } else if (g.endTime && g.serverTime) {
        const offset = g.serverTime - Date.now();
        setServerOff(offset);
        setEndTime(g.endTime);
        if (g.status === "COUNTDOWN") {
          const rem = Math.max(0, Math.ceil((g.endTime - Date.now() - offset) / 1e3));
          if (rem > 0)
            setCountdown(rem);
        }
      } else if (g.status === "COUNTDOWN" && g.countdownSeconds) {
        setCountdown((prev) => {
          if (prev !== null && prev >= 0 && prev <= g.countdownSeconds)
            return prev;
          return g.countdownSeconds;
        });
      }
      const sorted = (t.tickets || []).sort((a, b) => {
        var _a2, _b2;
        return (((_a2 = a.card) == null ? void 0 : _a2.id) || 0) - (((_b2 = b.card) == null ? void 0 : _b2.id) || 0);
      });
      setTickets(sorted);
      try {
        sessionStorage.setItem(`game_tickets_${gameId}`, JSON.stringify(sorted));
      } catch (e) {
      }
      const hist = (g.drawHistory || []).map((d) => d.number);
      setDrawn(hist);
      const latestBall = hist.at(-1);
      const isFirstLoad = isFirstLoadRef.current;
      if (isFirstLoad) {
        isFirstLoadRef.current = false;
        if (latestBall) {
          lastDrawnRef.current = latestBall;
          setLastBall(latestBall);
          setCalledHistory(hist);
        }
      } else {
        let newBalls = [];
        if (lastDrawnRef.current === 0) {
          newBalls = hist;
        } else {
          const playedIndex = hist.indexOf(lastDrawnRef.current);
          if (playedIndex !== -1) {
            newBalls = hist.slice(playedIndex + 1);
          } else {
            if (latestBall && latestBall !== lastDrawnRef.current) {
              newBalls = [latestBall];
            }
          }
        }
        if (newBalls.length > 0) {
          queueBallSounds(newBalls, setLastBall);
        }
      }
    }).catch(console.error);
  }, [gameId, queueBallSounds]);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);
  useEffect(() => {
    isFirstLoadRef.current = true;
    lastDrawnRef.current = 0;
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    setCalledHistory([]);
  }, [gameId]);
  useEffect(() => {
    const status = game == null ? void 0 : game.status;
    if (status === "WAITING" || status === "COUNTDOWN" || status === "FINISHED") {
      lastDrawnRef.current = 0;
      audioQueueRef.current = [];
      isPlayingQueueRef.current = false;
      if (status !== "FINISHED") {
        setCalledHistory([]);
      }
    }
  }, [game == null ? void 0 : game.status]);
  useEffect(() => {
    setMounted(true);
    const savedSound = localStorage.getItem("game_sound");
    if (savedSound !== null) {
      const val = savedSound === "true";
      setSoundOn(val);
      soundOnRef.current = val;
    }
    if (!gameId)
      return;
    loadData();
    const retryTimer = setTimeout(loadData, 1500);
    return () => {
      clearTimeout(retryTimer);
      if (toastTimer.current)
        clearTimeout(toastTimer.current);
    };
  }, [gameId]);
  useEffect(() => {
    if (!socket || !gameId)
      return;
    socket.emit("join-game", gameId);
    socket.on("number-drawn", (d) => {
      const num = Number(d.number);
      setDrawn((p) => p.includes(num) ? p : [...p, num]);
      queueBallSounds([num], setLastBall);
    });
    socket.on("countdown-start", (d) => {
      setCountdown(d.seconds);
      if (d.endTime && d.serverTime) {
        setServerOff(d.serverTime - Date.now());
        setEndTime(d.endTime);
      }
      if (d.seconds === 0) {
        playStartAudio();
        setTimeout(loadData, 300);
      }
    });
    socket.on("countdown-tick", (d) => {
      setCountdown(d.secondsRemaining);
      if (d.secondsRemaining === 0) {
        playStartAudio();
        setTimeout(loadData, 300);
      }
    });
    socket.on("game-started", () => {
      loadData();
      playStartAudio();
    });
    socket.on("game-finished", (d) => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g2;
      loadData();
      playStopAudio();
      const tgUserId = typeof window !== "undefined" && ((_d2 = (_c2 = (_b2 = (_a2 = window.Telegram) == null ? void 0 : _a2.WebApp) == null ? void 0 : _b2.initDataUnsafe) == null ? void 0 : _c2.user) == null ? void 0 : _d2.id) ? String(window.Telegram.WebApp.initDataUnsafe.user.id) : "";
      const myWinnerObj = (d.winners || []).find(
        (winner) => tgUserId && String(winner.userId) === tgUserId || ticketsRef.current.some((t) => String(t.id) === String(winner.ticketId) || String(t.userId) === String(winner.userId))
      );
      const isCurrentUserWinner = !!myWinnerObj;
      const w = myWinnerObj || ((_e2 = d.winners) == null ? void 0 : _e2[0]);
      const name = ((_f2 = w == null ? void 0 : w.user) == null ? void 0 : _f2.firstName) || ((_g2 = w == null ? void 0 : w.user) == null ? void 0 : _g2.telegramUsername) || "Someone";
      setGameFinished({
        winnerName: name,
        prize: (w == null ? void 0 : w.prizeAmount) || 0,
        mode: (w == null ? void 0 : w.winMode) || "",
        isWinner: !!w,
        card: w == null ? void 0 : w.card,
        isCurrentUserWinner
      });
      setRedirectSecs(5);
      redirectCountdownRef.current = setInterval(() => {
        setRedirectSecs((s) => {
          if (s <= 1) {
            clearInterval(redirectCountdownRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1e3);
      redirectTimerRef.current = setTimeout(() => {
        router.push("/tickets/select");
      }, 5e3);
    });
    socket.on("game-update", (d) => {
      setGame((p) => p ? __spreadValues(__spreadValues({}, p), d) : p);
    });
    socket.on("connect", () => {
      socket.emit("join-game", gameId);
      loadData();
    });
    return () => {
      socket.emit("leave-game", gameId);
      socket.off("number-drawn");
      socket.off("countdown-start");
      socket.off("countdown-tick");
      socket.off("game-started");
      socket.off("game-finished");
      socket.off("game-update");
      socket.off("connect");
    };
  }, [socket, gameId, loadData, queueBallSounds, playStartAudio, playStopAudio]);
  useEffect(() => {
    if (endTime === null)
      return;
    const timer = setInterval(() => {
      const now = Date.now() + serverOff;
      const rem = Math.max(0, Math.ceil((endTime - now) / 1e3));
      setCountdown(rem);
      if (rem <= 0) {
        playStartAudio();
        setEndTime(null);
        setTimeout(loadData, 300);
      }
    }, 1e3);
    return () => clearInterval(timer);
  }, [endTime, serverOff, loadData, playStartAudio]);
  useEffect(() => {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g2;
    const status = game == null ? void 0 : game.status;
    if (status === "FINISHED") {
      if (!gameFinished) {
        const winners = (game == null ? void 0 : game.winners) || [];
        const tgUserId = typeof window !== "undefined" && ((_d2 = (_c2 = (_b2 = (_a2 = window.Telegram) == null ? void 0 : _a2.WebApp) == null ? void 0 : _b2.initDataUnsafe) == null ? void 0 : _c2.user) == null ? void 0 : _d2.id) ? String(window.Telegram.WebApp.initDataUnsafe.user.id) : "";
        const myWinnerObj = winners.find(
          (winner) => tgUserId && String(winner.userId) === tgUserId || tickets.some((t) => String(t.id) === String(winner.ticketId) || String(t.userId) === String(winner.userId))
        );
        const isCurrentUserWinner = !!myWinnerObj;
        const w = myWinnerObj || winners[0];
        const name = ((_e2 = w == null ? void 0 : w.user) == null ? void 0 : _e2.firstName) || ((_f2 = w == null ? void 0 : w.user) == null ? void 0 : _f2.telegramUsername) || "Someone";
        setGameFinished({
          winnerName: name,
          prize: (w == null ? void 0 : w.prizeAmount) || 0,
          mode: (w == null ? void 0 : w.winMode) || "",
          isWinner: !!w,
          card: ((_g2 = w == null ? void 0 : w.ticket) == null ? void 0 : _g2.card) || (w == null ? void 0 : w.card),
          isCurrentUserWinner
        });
        playStopAudio();
        setRedirectSecs(5);
        redirectCountdownRef.current = setInterval(() => {
          setRedirectSecs((s) => {
            if (s <= 1) {
              clearInterval(redirectCountdownRef.current);
              return 0;
            }
            return s - 1;
          });
        }, 1e3);
        redirectTimerRef.current = setTimeout(() => {
          router.push("/tickets/select");
        }, 5e3);
      }
      return;
    }
    let intervalMs = 2e3;
    if (!status)
      intervalMs = 2e3;
    else if (status === "WAITING")
      intervalMs = 3e3;
    else if (status === "COUNTDOWN")
      intervalMs = 3e3;
    const poll = setInterval(() => {
      loadData();
    }, intervalMs);
    return () => clearInterval(poll);
  }, [game == null ? void 0 : game.status, loadData, router, gameFinished, playStopAudio]);
  const isCalled = (n) => drawn.includes(n);
  const isMarkedLocal = (n) => marked.has(n);
  const toggleMark = (n) => {
    if (!audioUnlocked)
      unlockAudio();
    if (typeof n !== "number" || n === 0)
      return;
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(n))
        next.delete(n);
      else
        next.add(n);
      return next;
    });
  };
  const unlockAudio = () => {
    if (audioUnlocked)
      return;
    setAudioUnlocked(true);
    const unlock = (el, src) => {
      if (!el)
        return;
      el.volume = 0;
      el.src = src;
      const p = el.play();
      if (p !== void 0) {
        p.then(() => {
          el.pause();
          el.currentTime = 0;
          el.volume = 1;
        }).catch(() => {
        });
      }
    };
    try {
      unlock(ballAudioRef.current, "/audio/B1.mp3");
    } catch (e) {
    }
  };
  const hideCard = (id) => setHidden((p) => /* @__PURE__ */ new Set([...p, id]));
  const handleBingo = async () => {
    var _a2, _b2;
    if (!gameId || claiming)
      return;
    setClaiming(true);
    try {
      const res = await claimBingo(gameId);
      if (res.won) {
        setToast(`\u{1F38A} BINGO! ${res.mode} (+${res.prize} ETB)`);
        if (toastTimer.current)
          clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4e3);
      } else {
        showAlert("Bingo Claim", res.error || "No Bingo detected yet! Check your patterns.", "info");
      }
    } catch (e) {
      showAlert("Error", ((_b2 = (_a2 = e.response) == null ? void 0 : _a2.data) == null ? void 0 : _b2.error) || "No Bingo yet! Keep playing.", "error");
    } finally {
      setClaiming(false);
    }
  };
  if (!mounted)
    return null;
  const BOT_COUNTS_FRONTEND = { CASUAL: 30, STANDARD: 30, PRO: 30, JACKPOT: 10, VIP: 10 };
  const roomTypeName = ((_g = game == null ? void 0 : game.room) == null ? void 0 : _g.type) || spType || "STANDARD";
  const botCount = (_h = BOT_COUNTS_FRONTEND[roomTypeName]) != null ? _h : 30;
  const fallbackPrize = Math.round((botCount + tickets.length) * stake * 0.75);
  const prize = isDemo ? (game == null ? void 0 : game.totalPrize) ? Number(game.totalPrize) : 100 : Math.max(
    (game == null ? void 0 : game.totalPrize) && Number(game.totalPrize) > 0 ? Number(game.totalPrize) : 0,
    fallbackPrize
  );
  const fallbackHouseComm = Math.round((botCount + tickets.length) * stake * 0.25);
  const houseComm = isDemo ? 0 : Math.max(
    (game == null ? void 0 : game.houseEdge) && Number(game.houseEdge) > 0 ? Number(game.houseEdge) : 0,
    fallbackHouseComm
  );
  const fallbackCards = botCount + tickets.length;
  const allCards = Math.max((game == null ? void 0 : game.currentPlayers) || 0, fallbackCards) || 1;
  const totalStake = isDemo ? 0 : allCards * stake;
  const cdText = countdown !== null ? `${countdown}s` : (game == null ? void 0 : game.status) === "WAITING" ? "WAIT" : "LIVE";
  const visible = tickets.filter((t) => !hidden.has(t.id));
  const checkAnyBingo = () => {
    var _a2, _b2;
    if (drawn.length === 0)
      return false;
    const drawnSet = new Set(drawn);
    for (const t of tickets) {
      if (hidden.has(t.id))
        continue;
      const rows = (_b2 = (_a2 = t.card) == null ? void 0 : _a2.rows) != null ? _b2 : [];
      if (rows.length === 0)
        continue;
      const isMarked = (r, c) => {
        const val = rows[r][c];
        const numVal = Number(val);
        return val === "FREE" || val === 0 || val === null || drawnSet.has(numVal) && marked.has(numVal);
      };
      for (let r = 0; r < 5; r++)
        if ([0, 1, 2, 3, 4].every((c) => isMarked(r, c)))
          return true;
      for (let c = 0; c < 5; c++)
        if ([0, 1, 2, 3, 4].every((r) => isMarked(r, c)))
          return true;
      if ([0, 1, 2, 3, 4].every((i) => isMarked(i, i)))
        return true;
      if ([0, 1, 2, 3, 4].every((i) => isMarked(i, 4 - i)))
        return true;
      if (isMarked(0, 0) && isMarked(0, 4) && isMarked(4, 0) && isMarked(4, 4))
        return true;
    }
    return false;
  };
  const hasBingo = checkAnyBingo();
  return <div
    onClick={unlockAudio}
    onTouchStart={unlockAudio}
    style={{
      background: isVip ? "radial-gradient(circle at top, #2D1442 0%, #1C0A35 60%, #0F041A 100%)" : T.bg,
      minHeight: "100vh",
      paddingBottom: "180px",
      fontFamily: "'Segoe UI', sans-serif",
      overflowX: "hidden",
      color: isVip ? "#FFFFFF" : T.text
    }}
  >
    <audio id="audio-start" src="/audio/start.mp3" preload="auto" />
    <audio id="audio-stop" src="/audio/stop.mp3" preload="auto" />
    <div style={{ background: isVip ? "#1C0A35" : T.header, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: isVip ? `3px solid #FFD700` : `3px solid ${T.gold}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ color: isVip ? "#C471ED" : T.gold, fontWeight: "900", fontSize: "18px", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <ShieldCheck size={20} color={isVip ? "#C471ED" : T.gold} />
        {" BUNA GAME ZONE"}
        {isVip && <span style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#1C0A35", fontSize: "9px", fontWeight: "900", padding: "2px 8px", borderRadius: "12px", boxShadow: "0 0 10px rgba(255, 215, 0, 0.6)", display: "inline-flex", alignItems: "center", gap: "3px", border: "1.5px solid #FFF", letterSpacing: "0.5px" }}>{"\u{1F451} BOSS VIP"}</span>}
      </div>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <div style={{ background: (game == null ? void 0 : game.status) === "RUNNING" ? "#27AE60" : "#E67E22", color: "white", fontSize: "10px", fontWeight: "900", padding: "3px 10px", borderRadius: "20px" }}>{(game == null ? void 0 : game.status) || "LOADING"}</div>
        <motion.div
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            const next = !soundOn;
            setSoundOn(next);
            localStorage.setItem("game_sound", String(next));
            if (!audioUnlocked)
              unlockAudio();
          }}
          style={{
            background: "rgba(0,0,0,0.2)",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: soundOn ? isVip ? "#FFD700" : T.gold : "#7F8C8D",
            cursor: "pointer",
            border: `1px solid ${soundOn ? isVip ? "#FFD700" : T.gold : "#7F8C8D"}44`
          }}
        >{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</motion.div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", padding: "8px", background: isVip ? "rgba(255,255,255,0.02)" : T.statBg, borderBottom: isVip ? "1px solid rgba(255,215,0,0.2)" : `1px solid ${T.gold}44` }}>{[
      ["GAME ID", (gameId == null ? void 0 : gameId.slice(-6).toUpperCase()) || "--"],
      ["CARDS", `${allCards}`],
      ["STAKE/CARD", `${stake} ETB`],
      ["PRIZE 75%", `${prize.toFixed ? prize.toFixed(0) : prize} ETB`]
    ].map(([l, v]) => {
      const isPrize = l === "PRIZE 75%";
      return <div key={l} style={{
        background: isVip ? isPrize ? "linear-gradient(90deg, #FFD700, #FFA500)" : "rgba(255, 255, 255, 0.05)" : isPrize ? T.gold : T.card,
        border: isVip ? isPrize ? "none" : "1px solid rgba(255, 215, 0, 0.25)" : `1px solid ${T.gold}33`,
        padding: "6px 4px",
        textAlign: "center",
        borderRadius: "8px",
        backdropFilter: isVip && !isPrize ? "blur(10px)" : "none",
        boxShadow: isVip && isPrize ? "0 4px 15px rgba(255, 215, 0, 0.3)" : "none"
      }}>
        <div style={{
          fontSize: "8px",
          fontWeight: "bold",
          color: isVip ? isPrize ? "rgba(28, 10, 53, 0.8)" : "#FFD700" : isPrize ? T.header : T.brown
        }}>{l}</div>
        <div style={{
          fontSize: "12px",
          fontWeight: "900",
          color: isVip ? isPrize ? "#1C0A35" : "white" : isPrize ? T.header : T.text
        }}>{v}</div>
      </div>;
    })}</div>
    <div style={{ display: "flex", gap: "10px", padding: "10px", alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 52%", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{
            flex: 1,
            background: (game == null ? void 0 : game.status) === "RUNNING" ? "#27AE60" : isVip ? "rgba(255,255,255,0.05)" : T.header,
            borderRadius: "14px",
            padding: "10px",
            textAlign: "center",
            border: isVip ? "2px solid #FFD700" : `2px solid ${T.gold}`,
            transition: "background 0.3s",
            boxShadow: isVip ? "0 0 10px rgba(255, 215, 0, 0.2)" : "none"
          }}>
            <div style={{ color: isVip ? "#FFD700" : T.gold, fontSize: "9px", fontWeight: "900" }}>COUNT DOWN</div>
            <div style={{ color: (game == null ? void 0 : game.status) === "RUNNING" ? "white" : isVip ? "white" : activeThemeKey === "LIGHT" ? "#333" : "white", fontSize: "24px", fontWeight: "900" }}>{cdText}</div>
          </div>
          <motion.div
            key={lastBall}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            style={{
              width: "65px",
              height: "65px",
              background: lastBall ? isVip ? "linear-gradient(135deg, #FFD700 0%, #C471ED 100%)" : COL_COLOR[colLabel(lastBall)] : isVip ? "rgba(255,255,255,0.05)" : T.statBg,
              borderRadius: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "900",
              border: isVip ? "4px solid #FFD700" : `4px solid ${T.gold}`,
              color: lastBall ? isVip ? "#1C0A35" : "white" : isVip ? "#FFD700" : T.brown,
              boxShadow: isVip ? "0 0 15px rgba(255, 215, 0, 0.6)" : "none"
            }}
          >{lastBall ? <>
            <div style={{ fontSize: "14px", lineHeight: 1 }}>{colLabel(lastBall)}</div>
            <div style={{ fontSize: "24px", lineHeight: 1 }}>{lastBall}</div>
          </> : "\u2022"}</motion.div>
        </div>
        <div style={{ background: isVip ? "rgba(255,255,255,0.02)" : T.statBg, borderRadius: "12px", padding: "6px 10px", border: isVip ? "1px solid rgba(255,215,0,0.2)" : `1px solid ${T.gold}33`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: isVip ? "#FFD700" : T.brown, fontSize: "9px", fontWeight: "900", letterSpacing: "0.5px" }}>RECENT BALLS</span>
          <div style={{ display: "flex", gap: "5px" }}>
            {calledHistory.slice(-4).reverse().map((ball) => {
              const label = colLabel(ball);
              const color = isVip ? "linear-gradient(135deg, #FFD700, #C471ED)" : COL_COLOR[label];
              return <motion.div
                key={ball}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  background: color,
                  color: isVip ? "#1C0A35" : "white",
                  fontWeight: "900",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: isVip ? "1.5px solid #FFD700" : "1.5px solid white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                }}
              >
                <span style={{ fontSize: "8px", lineHeight: 1, opacity: 0.8 }}>{label}</span>
                <span style={{ fontSize: "13px", lineHeight: 1, marginTop: "-1px" }}>{ball}</span>
              </motion.div>;
            })}
            {calledHistory.length === 0 && <span style={{ color: isVip ? "rgba(255,255,255,0.4)" : T.brown, fontSize: "9px", fontWeight: "800", opacity: 0.6 }}>Waiting for draw...</span>}
          </div>
        </div>
        <div style={{ background: isVip ? "rgba(255,255,255,0.05)" : T.card, borderRadius: "14px", padding: "10px", border: isVip ? "1px solid rgba(255, 215, 0, 0.25)" : `1px solid ${T.gold}44`, backdropFilter: isVip ? "blur(10px)" : "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "3px", marginBottom: "6px" }}>{["B", "I", "N", "G", "O"].map((l) => <div key={l} style={{
            background: isVip ? "linear-gradient(135deg, #FFD700, #C471ED)" : COL_COLOR[l],
            color: isVip ? "#1C0A35" : "white",
            textAlign: "center",
            fontSize: "13px",
            fontWeight: "900",
            borderRadius: "6px",
            padding: "4px 0",
            boxShadow: isVip ? "0 2px 5px rgba(0,0,0,0.15)" : "none"
          }}>{l}</div>)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "2px" }}>{Array.from({ length: 15 }, (_, i) => COL_RANGES.map((col) => {
            const n = col.s + i;
            return <div key={n} style={{
              background: isCalled(n) ? isVip ? "linear-gradient(135deg, #FFD700, #C471ED)" : COL_COLOR[col.l] : isVip ? "rgba(255,255,255,0.05)" : T.statBg,
              color: isCalled(n) ? "#1C0A35" : isVip ? "rgba(255,255,255,0.6)" : T.text,
              border: isVip && isCalled(n) ? "1px solid #FFD700" : "none",
              fontSize: "10px",
              fontWeight: "900",
              textAlign: "center",
              padding: "5.5px 0",
              borderRadius: "4px"
            }}>{n}</div>;
          }))}</div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              height: "42px",
              background: "#00A8E8",
              color: "white",
              border: "none",
              borderRadius: "16px",
              fontWeight: "900",
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,168,232,0.2)"
            }}
          >
            <RefreshCw size={14} />
            {" Refresh"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              height: "42px",
              background: "#E74C3C",
              color: "white",
              border: "none",
              borderRadius: "16px",
              fontWeight: "900",
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(231,76,60,0.2)"
            }}
          >
            <LogOut size={14} />
            {" Leave"}
          </motion.button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ color: isVip ? "white" : T.text, fontWeight: "900", fontSize: "13px", padding: "0 5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>
          {"\u{1F3C6} YOUR CARTELAS ("}
          {visible.length}
          {")"}
        </span></div>
        {hasBingo && (game == null ? void 0 : game.status) === "RUNNING" && <motion.div
          animate={{
            scale: [1, 1.04, 1],
            boxShadow: ["0 0 10px #FFD70066", "0 0 30px #FFD700cc", "0 0 10px #FFD70066"]
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{
            background: "linear-gradient(135deg, #FFD700, #FF6B00)",
            borderRadius: "14px",
            padding: "10px 14px",
            textAlign: "center",
            margin: "0 4px",
            cursor: "pointer"
          }}
          onClick={handleBingo}
        >
          <div style={{ fontSize: "20px", lineHeight: 1 }}>{"\u{1F38A}"}</div>
          <div style={{ color: "#1a0a00", fontWeight: "900", fontSize: "14px", letterSpacing: 1 }}>BINGO PATTERN FOUND!</div>
          <div style={{ color: "#1a0a00", fontSize: "11px", fontWeight: "700", opacity: 0.8, marginTop: "2px" }}>{"\u{1F446} TAP HERE or press BINGO! button NOW!"}</div>
        </motion.div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", padding: "0 5px" }}>{["B", "I", "N", "G", "O"].map((l) => <div
          key={l}
          style={{
            background: isVip ? "linear-gradient(135deg, #FFD700, #C471ED)" : COL_COLOR[l],
            color: isVip ? "#1C0A35" : "white",
            textAlign: "center",
            fontSize: "12px",
            fontWeight: "900",
            borderRadius: "50%",
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
          }}
        >{l}</div>)}</div>
        {visible.map((t) => {
          var _a2, _b2;
          const cardObj = t.card;
          const rows = (_a2 = cardObj == null ? void 0 : cardObj.rows) != null ? _a2 : [];
          const cardId = (_b2 = cardObj == null ? void 0 : cardObj.id) != null ? _b2 : "?";
          const isSelected = selectedTicketId === t.id;
          return <motion.div
            layout
            key={t.id}
            onClick={() => setSelectedTicketId(t.id)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: isSelected ? 1.02 : 1 }}
            style={{
              position: "relative",
              background: isVip ? "rgba(255,255,255,0.04)" : T.card,
              borderRadius: "16px",
              overflow: "hidden",
              border: isSelected ? isVip ? "3px solid #FFD700" : `3px solid ${T.gold}` : isVip ? "2px solid rgba(255, 215, 0, 0.2)" : `2px solid ${T.gold}55`,
              boxShadow: isSelected ? isVip ? "0 8px 25px rgba(255, 215, 0, 0.3)" : `0 8px 20px ${T.gold}44` : "0 4px 10px rgba(0,0,0,0.05)",
              cursor: "pointer",
              transition: "all 0.2s",
              backdropFilter: isVip ? "blur(10px)" : "none"
            }}
          >
            <button onClick={(e) => {
              e.stopPropagation();
              hideCard(t.id);
            }} style={{ position: "absolute", top: "4px", right: "5px", width: "20px", height: "20px", background: "#C0392B", color: "white", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}><X size={10} /></button>
            <div style={{
              background: isSelected ? isVip ? "linear-gradient(90deg, #FFD700, #C471ED)" : T.gold : isVip ? "#1C0A35" : T.header,
              padding: "4px 10px",
              color: isSelected ? isVip ? "#1C0A35" : T.header : isVip ? "#FFD700" : T.gold,
              fontWeight: "900",
              fontSize: "11px"
            }}>
              {"Cartela #"}
              {cardId}
              {" "}
              {isSelected ? "(SELECTED)" : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "2px", padding: "5px" }}>{rows.map((row, ri) => row.map((cell, ci) => {
              const numVal = Number(cell);
              const isFree = cell === "FREE" || cell === 0 || cell === null;
              const isBallCalled = !isFree && drawn.includes(numVal);
              const userDaubed = !isFree && marked.has(numVal);
              const colClr = COL_COLOR[colLabel(numVal)] || "#888";
              let bg, txtClr, bdr, shd;
              if (isFree) {
                bg = "#27AE60";
                txtClr = "white";
                bdr = "none";
                shd = `0 0 8px #27AE6055`;
              } else if (isBallCalled && userDaubed) {
                bg = isVip ? "linear-gradient(135deg, #FFD700, #C471ED)" : T.gold;
                txtClr = isVip ? "#1C0A35" : T.header;
                bdr = `2px solid ${isVip ? "#FFD700" : "white"}`;
                shd = `0 0 10px ${isVip ? "#FFD70099" : T.gold + "88"}`;
              } else if (isBallCalled) {
                bg = `${colClr}2a`;
                txtClr = colClr;
                bdr = `2px solid ${colClr}99`;
                shd = `0 0 7px ${colClr}55`;
              } else {
                bg = isVip ? "rgba(255,255,255,0.06)" : T.statBg;
                txtClr = isVip ? "rgba(255,255,255,0.55)" : T.text;
                bdr = "none";
                shd = "none";
              }
              return <motion.div
                key={`${ri}-${ci}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isFree)
                    toggleMark(numVal);
                }}
                animate={isBallCalled && userDaubed ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={isBallCalled && userDaubed ? { duration: 1, repeat: Infinity, repeatDelay: 1.5 } : {}}
                style={{
                  height: "26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "900",
                  background: bg,
                  color: txtClr,
                  border: bdr,
                  boxShadow: shd,
                  position: "relative",
                  overflow: "hidden",
                  cursor: isFree ? "default" : "pointer",
                  transition: "background 0.25s, box-shadow 0.25s, border 0.25s",
                  userSelect: "none"
                }}
              >
                {isFree ? "\u2605" : cell}
                {isBallCalled && userDaubed && <motion.div
                  initial={{ scale: 0, opacity: 0.7 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.5 }}
                  style={{ position: "absolute", width: "50%", height: "50%", border: `2px solid ${isVip ? "#FFD700" : T.gold}`, borderRadius: "50%", pointerEvents: "none" }}
                />}
                {isBallCalled && !userDaubed && <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  style={{ position: "absolute", bottom: "2px", right: "2px", width: "5px", height: "5px", borderRadius: "50%", background: colClr, boxShadow: `0 0 4px ${colClr}` }}
                />}
              </motion.div>;
            }))}</div>
            <div style={{ padding: "0 5px 6px 5px" }}><motion.button
              whileTap={(game == null ? void 0 : game.status) === "RUNNING" && !claiming ? { scale: 0.94 } : {}}
              animate={hasBingo && (game == null ? void 0 : game.status) === "RUNNING" && !claiming ? { scale: [1, 1.06, 1], boxShadow: ["0 0 8px #FFD70066", "0 0 24px #FFD700cc", "0 0 8px #FFD70066"] } : { scale: 1, boxShadow: (game == null ? void 0 : game.status) === "RUNNING" && !claiming ? "0 4px 10px rgba(230,126,34,0.3)" : "none" }}
              transition={hasBingo && (game == null ? void 0 : game.status) === "RUNNING" ? { duration: 0.7, repeat: Infinity } : {}}
              onClick={(e) => {
                e.stopPropagation();
                if ((game == null ? void 0 : game.status) === "RUNNING" && !claiming)
                  handleBingo();
              }}
              disabled={(game == null ? void 0 : game.status) !== "RUNNING" || claiming}
              style={{
                width: "100%",
                background: (game == null ? void 0 : game.status) === "RUNNING" ? claiming ? "#7F8C8D" : hasBingo ? "linear-gradient(135deg, #FFD700, #FF6B00)" : isVip ? "linear-gradient(135deg, #FFD700, #C471ED)" : "linear-gradient(135deg, #F39C12, #E67E22)" : isVip ? "rgba(255,255,255,0.05)" : "rgba(150,150,150,0.1)",
                color: (game == null ? void 0 : game.status) === "RUNNING" ? hasBingo ? "#1a0a00" : isVip ? "#1C0A35" : "white" : isVip ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)",
                border: hasBingo && (game == null ? void 0 : game.status) === "RUNNING" ? "2px solid #fff" : isVip && (game == null ? void 0 : game.status) === "RUNNING" && !claiming ? "2px solid #FFFFFF" : "none",
                borderRadius: "12px",
                height: hasBingo && (game == null ? void 0 : game.status) === "RUNNING" ? "42px" : "36px",
                fontWeight: "900",
                fontSize: hasBingo && (game == null ? void 0 : game.status) === "RUNNING" ? "15px" : "13px",
                cursor: (game == null ? void 0 : game.status) === "RUNNING" && !claiming ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "height 0.2s, font-size 0.2s"
              }}
            >{claiming ? "\u23F3 CLAIMING..." : hasBingo && (game == null ? void 0 : game.status) === "RUNNING" ? `\u{1F38A} BINGO! CLAIM NOW! (${cardId})` : `\u2615 BINGO! (${cardId})`}</motion.button></div>
          </motion.div>;
        })}
        {tickets.length === 0 && <div style={{ textAlign: "center", color: isVip ? "white" : T.brown, padding: "40px" }}>Fetching cards...</div>}
      </div>
    </div>
    <motion.div
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.05 }}
      className="premium-fab"
      onClick={() => {
        var _a2;
        return router.push(`/tickets/select?type=${((_a2 = game == null ? void 0 : game.room) == null ? void 0 : _a2.type) || spType || "STANDARD"}&price=${stake}&gameId=${gameId || ""}`);
      }}
      style={{
        position: "fixed",
        bottom: "100px",
        right: "20px",
        width: "64px",
        height: "64px",
        background: fabBg,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        cursor: "pointer",
        border: `2px solid ${fabBorder}`,
        boxShadow: `0 10px 28px rgba(0, 0, 0, 0.4), inset 0 3px 6px rgba(255, 255, 255, 0.5), inset 0 -3px 8px rgba(0, 0, 0, 0.5)`,
        userSelect: "none"
      }}
    ><div style={{
      width: "82%",
      height: "82%",
      borderRadius: "50%",
      border: `1.5px solid ${fabInnerRing}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `inset 0 3px 4px rgba(255, 255, 255, 0.35), inset 0 -3px 4px rgba(0, 0, 0, 0.3)`,
      position: "relative"
    }}><Plus
      size={28}
      strokeWidth={4.2}
      style={{
        color: fabPlusColor,
        filter: "drop-shadow(0px 2.5px 2px rgba(0,0,0,0.35))"
      }}
    /></div></motion.div>
    <AnimatePresence>{gameFinished && <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,5,0,0.96)", zIndex: 5e3, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: "12px" }}
    >
      {["\u{1F389}", "\u2B50", "\u{1F31F}", "\u2728", "\u{1F38A}", "\u{1F4AB}", "\u{1F389}", "\u2B50"].map((e, i) => <motion.div
        key={i}
        initial={{ y: -20, opacity: 0, x: (i - 4) * 40 }}
        animate={{ y: [0, -60, 0], opacity: [0, 1, 0] }}
        transition={{ delay: i * 0.15, duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
        style={{ position: "absolute", top: "8%", fontSize: "24px", left: `${10 + i * 11}%`, pointerEvents: "none" }}
      >{e}</motion.div>)}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        style={{
          background: `linear-gradient(160deg, ${T.card} 0%, #1a0f00 100%)`,
          border: `3px solid ${T.gold}`,
          borderRadius: "24px",
          padding: "20px 18px 18px",
          textAlign: "center",
          maxWidth: "380px",
          width: "100%",
          boxShadow: `0 0 60px ${T.gold}55`,
          position: "relative",
          overflowY: "auto",
          maxHeight: "88vh"
        }}
      >
        <div style={{ fontSize: "54px", lineHeight: 1, marginBottom: "4px" }}>{gameFinished.isCurrentUserWinner ? "\u{1F3C6}" : "\u{1F3AF}"}</div>
        {gameFinished.isCurrentUserWinner ? <>
          <motion.h2
            animate={{ textShadow: [`0 0 10px ${T.gold}88`, `0 0 30px ${T.gold}ff`, `0 0 10px ${T.gold}88`] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ color: T.gold, fontSize: "26px", fontWeight: "900", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 3 }}
          >{"YOU WON! \u{1F38A}"}</motion.h2>
          <div style={{ color: "#2ECC71", fontSize: "13px", fontWeight: "700", marginBottom: "4px" }}>{"\u{1F389} Congratulations! You are the winner!"}</div>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ color: T.gold, fontSize: "24px", fontWeight: "900", margin: "2px 0 10px" }}
          >
            {"+"}
            {gameFinished.prize}
            {" ETB"}
          </motion.div>
        </> : <>
          <h2 style={{ color: "#E74C3C", fontSize: "22px", fontWeight: "900", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 2 }}>GAME OVER</h2>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: "700", marginBottom: "2px" }}>
            {"\u{1F947} Winner: "}
            <span style={{ color: T.gold }}>{gameFinished.winnerName}</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px", fontWeight: "700", margin: "2px 0 10px" }}>
            {"Prize: "}
            <span style={{ color: "#F59E0B" }}>
              {gameFinished.prize}
              {" ETB"}
            </span>
          </div>
        </>}
        {gameFinished.mode && gameFinished.card && (() => {
          var _a2;
          const rawCard2 = gameFinished.card;
          const rows2 = Array.isArray(rawCard2) ? rawCard2 : (_a2 = rawCard2.rows) != null ? _a2 : rawCard2;
          const grid2 = rows2.map(
            (row) => row.map((cell) => cell === "FREE" || cell === "free" || cell === null ? 0 : Number(cell))
          );
          const calledSet2 = new Set(drawn);
          const isM2 = (r, c) => grid2[r][c] === 0 || calledSet2.has(grid2[r][c]);
          const COL_LBL = ["B", "I", "N", "G", "O"];
          const ROW_ORD = ["1st", "2nd", "3rd", "4th", "5th"];
          const mode = gameFinished.mode;
          let specificLabel = mode.replace(/_/g, " ");
          let specificIcon = "\u{1F3AF}";
          let color = "#2ECC71";
          if (mode === "FULL_HOUSE") {
            specificLabel = "FULL HOUSE";
            specificIcon = "\u{1F0CF}";
            color = "#FF6B35";
          } else if (mode === "FOUR_CORNERS") {
            specificLabel = "FOUR CORNERS";
            specificIcon = "\u{1F537}";
            color = "#8B5CF6";
          } else if (mode === "DIAGONAL") {
            color = "#06B6D4";
            const main = [0, 1, 2, 3, 4].every((i) => isM2(i, i));
            const anti = [0, 1, 2, 3, 4].every((i) => isM2(i, 4 - i));
            if (main && anti) {
              specificLabel = "BOTH DIAGONALS \u2715";
              specificIcon = "\u2715";
            } else if (main) {
              specificLabel = "MAIN DIAGONAL \u2198";
              specificIcon = "\u2198";
            } else {
              specificLabel = "ANTI-DIAGONAL \u2197";
              specificIcon = "\u2197";
            }
          } else if (mode === "COLUMN") {
            color = "#10B981";
            for (let c = 0; c < 5; c++) {
              if ([0, 1, 2, 3, 4].every((r) => isM2(r, c))) {
                specificLabel = `COLUMN ${c + 1} \u258C`;
                specificIcon = "\u258C";
                break;
              }
            }
          } else if (mode === "ROW") {
            color = "#F59E0B";
            for (let r = 0; r < 5; r++) {
              if ([0, 1, 2, 3, 4].every((c) => isM2(r, c))) {
                specificLabel = `ROW ${r + 1} \u2501`;
                specificIcon = "\u2501";
                break;
              }
            }
          }
          return <motion.div
            animate={{ boxShadow: [`0 0 0px ${color}00`, `0 0 20px ${color}99`, `0 0 0px ${color}00`] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              background: `${color}22`,
              border: `2px solid ${color}99`,
              borderRadius: "20px",
              padding: "6px 16px",
              marginBottom: "10px",
              fontSize: "13px",
              fontWeight: "900",
              color,
              letterSpacing: "1px",
              textTransform: "uppercase"
            }}
          >
            <span style={{ fontSize: "17px" }}>{specificIcon}</span>
            <span>
              {"WINNING PATTERN: "}
              {specificLabel}
            </span>
          </motion.div>;
        })()}
        {gameFinished.card && (() => {
          var _a2;
          const rawCard = gameFinished.card;
          const rows = Array.isArray(rawCard) ? rawCard : (_a2 = rawCard.rows) != null ? _a2 : rawCard;
          if (!rows || rows.length !== 5)
            return null;
          const grid = rows.map(
            (row) => row.map((cell) => cell === "FREE" || cell === "free" || cell === null ? 0 : Number(cell))
          );
          const calledSet = new Set(drawn);
          const isM = (r, c) => grid[r][c] === 0 || calledSet.has(grid[r][c]);
          const patternCells = /* @__PURE__ */ new Set();
          const mode = gameFinished.mode;
          let winningRow = -1;
          let winningCol = -1;
          if (mode === "FULL_HOUSE") {
            for (let r = 0; r < 5; r++)
              for (let c = 0; c < 5; c++)
                patternCells.add(`${r}-${c}`);
          } else if (mode === "FOUR_CORNERS") {
            [[0, 0], [0, 4], [4, 0], [4, 4]].forEach(([r, c]) => patternCells.add(`${r}-${c}`));
          } else if (mode === "DIAGONAL") {
            const mainDiag = [0, 1, 2, 3, 4].every((i) => isM(i, i));
            const antiDiag = [0, 1, 2, 3, 4].every((i) => isM(i, 4 - i));
            if (mainDiag)
              [0, 1, 2, 3, 4].forEach((i) => patternCells.add(`${i}-${i}`));
            if (antiDiag)
              [0, 1, 2, 3, 4].forEach((i) => patternCells.add(`${i}-${4 - i}`));
          } else if (mode === "COLUMN") {
            for (let c = 0; c < 5; c++) {
              if ([0, 1, 2, 3, 4].every((r) => isM(r, c))) {
                winningCol = c;
                [0, 1, 2, 3, 4].forEach((r) => patternCells.add(`${r}-${c}`));
                break;
              }
            }
          } else if (mode === "ROW") {
            for (let r = 0; r < 5; r++) {
              if ([0, 1, 2, 3, 4].every((c) => isM(r, c))) {
                winningRow = r;
                [0, 1, 2, 3, 4].forEach((c) => patternCells.add(`${r}-${c}`));
                break;
              }
            }
          }
          const patternColors = {
            FULL_HOUSE: "#FF6B35",
            FOUR_CORNERS: "#8B5CF6",
            DIAGONAL: "#06B6D4",
            COLUMN: "#10B981",
            ROW: "#F59E0B"
          };
          const patternColor = patternColors[mode] || "#2ECC71";
          const COL_LABELS = ["B", "I", "N", "G", "O"];
          const COL_COLORS = { B: "#E74C3C", I: "#E67E22", N: "#D4AF37", G: "#27AE60", O: "#8E44AD" };
          return <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: "800", color: "rgba(255,255,255,0.45)", marginBottom: "6px", letterSpacing: "1px", textTransform: "uppercase" }}>
              {"\u{1F4CB} "}
              {gameFinished.isCurrentUserWinner ? "Your Winning Cartela" : `${gameFinished.winnerName}'s Winning Cartela`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mode === "ROW" ? "20px repeat(5, 1fr)" : "repeat(5, 1fr)", gap: "3px", marginBottom: "3px", padding: mode === "ROW" ? "0 0 0 3px" : "0 6px" }}>
              {mode === "ROW" && <div />}
              {COL_LABELS.map((lbl, ci) => {
                const isWinCol = winningCol === ci;
                return <div key={lbl} style={{
                  fontSize: isWinCol ? "16px" : "13px",
                  fontWeight: "900",
                  color: isWinCol ? "#fff" : COL_COLORS[lbl],
                  textAlign: "center",
                  letterSpacing: "1px",
                  background: isWinCol ? `${patternColor}cc` : "transparent",
                  borderRadius: isWinCol ? "6px" : "0",
                  padding: isWinCol ? "2px 0" : "0",
                  boxShadow: isWinCol ? `0 0 12px ${patternColor}` : "none",
                  textShadow: isWinCol ? "none" : `0 0 8px ${COL_COLORS[lbl]}88`
                }}>{lbl}</div>;
              })}
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: mode === "ROW" ? "20px repeat(5, 1fr)" : "repeat(5, 1fr)",
              gap: "3px",
              background: "rgba(0,0,0,0.5)",
              padding: "6px",
              borderRadius: "12px",
              border: `2px solid ${patternColor}66`,
              boxShadow: `inset 0 2px 12px rgba(0,0,0,0.6), 0 0 20px ${patternColor}22`
            }}>{grid.map((row, ri) => <Fragment key={ri}>
              {mode === "ROW" && <div key={`lbl-${ri}`} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "9px",
                fontWeight: "900",
                color: winningRow === ri ? patternColor : "rgba(255,255,255,0.2)",
                textShadow: winningRow === ri ? `0 0 8px ${patternColor}` : "none"
              }}>{ri + 1}</div>}
              {row.map((cell, ci) => {
                const key = `${ri}-${ci}`;
                const isFree = cell === 0;
                const called = isFree || calledSet.has(cell);
                const isPatternCell = patternCells.has(key);
                const colColor = COL_COLORS[COL_LABELS[ci]];
                let bg = "rgba(255,255,255,0.04)";
                let textColor = "rgba(255,255,255,0.2)";
                let shadow = "none";
                let border = "1px solid rgba(255,255,255,0.07)";
                if (isPatternCell) {
                  bg = `${patternColor}ee`;
                  textColor = "#fff";
                  shadow = `0 0 16px ${patternColor}cc, 0 0 5px ${patternColor}`;
                  border = `2px solid ${patternColor}`;
                } else if (called) {
                  bg = `${colColor}28`;
                  textColor = colColor;
                  shadow = `0 0 6px ${colColor}44`;
                  border = `1px solid ${colColor}55`;
                }
                return <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={isPatternCell ? { opacity: 1, scale: [1, 1.12, 1] } : { opacity: 1, scale: 1 }}
                  transition={isPatternCell ? { duration: 0.9, repeat: Infinity, repeatDelay: 1.2, delay: (ri + ci) * 0.03 } : { delay: (ri * 5 + ci) * 0.02 }}
                  style={{
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "900",
                    background: bg,
                    color: textColor,
                    borderRadius: "7px",
                    boxShadow: shadow,
                    border,
                    position: "relative",
                    minWidth: "0"
                  }}
                >{isFree ? <span style={{ fontSize: "13px" }}>{"\u2605"}</span> : cell}</motion.div>;
              })}
            </Fragment>)}</div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "7px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: patternColor, boxShadow: `0 0 5px ${patternColor}` }} />
                {"Winning cells"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "rgba(231,76,60,0.3)", border: "1px solid #E74C3C88" }} />
                {"Called"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }} />
                {"Not called"}
              </div>
            </div>
          </div>;
        })()}
        <div style={{ color: T.text, fontSize: "13px", marginBottom: "16px", opacity: 0.7 }}>
          {"Redirecting in "}
          <span style={{ color: T.gold, fontWeight: "900" }}>
            {redirectSecs}
            {"s"}
          </span>
          {"..."}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => {
              var _a2;
              clearTimeout(redirectTimerRef.current);
              clearInterval(redirectCountdownRef.current);
              router.push(`/tickets/select?type=${((_a2 = game == null ? void 0 : game.room) == null ? void 0 : _a2.type) || spType || "STANDARD"}&price=${stake}`);
            }}
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${T.gold}, #c47a1e)`,
              color: "#1a0a00",
              padding: "14px 8px",
              borderRadius: "14px",
              fontWeight: "900",
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
              boxShadow: `0 4px 16px ${T.gold}55`
            }}
          >{"\u{1F3AE} PLAY AGAIN"}</button>
          <button
            onClick={() => {
              clearTimeout(redirectTimerRef.current);
              clearInterval(redirectCountdownRef.current);
              router.push("/");
            }}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.08)",
              color: T.header,
              padding: "14px 8px",
              borderRadius: "14px",
              fontWeight: "700",
              fontSize: "13px",
              border: `1px solid ${T.gold}44`,
              cursor: "pointer"
            }}
          >{"\u{1F3E0} LOBBY"}</button>
        </div>
      </motion.div>
    </motion.div>}</AnimatePresence>
    <style dangerouslySetInnerHTML={{ __html: `
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: ${T.gold}44; border-radius: 10px; }
        @keyframes pulse-fab {
          0% { 
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 2px 5px rgba(255, 255, 255, 0.45), inset 0 -3px 8px rgba(0, 0, 0, 0.45), 0 0 5px ${T.gold}44; 
          }
          50% { 
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45), inset 0 2px 5px rgba(255, 255, 255, 0.55), inset 0 -3px 8px rgba(0, 0, 0, 0.55), 0 0 22px ${T.gold}cc; 
          }
          100% { 
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 2px 5px rgba(255, 255, 255, 0.45), inset 0 -3px 8px rgba(0, 0, 0, 0.45), 0 0 5px ${T.gold}44; 
          }
        }
        .premium-fab {
          animation: pulse-fab 2.5s infinite ease-in-out;
        }
      ` }} />
    <BunaModal
      isOpen={modal.isOpen}
      onClose={() => setModal((p) => __spreadProps(__spreadValues({}, p), { isOpen: false }))}
      title={modal.title}
      message={modal.message}
      type={modal.type}
    />
  </div>;
}
export default function GamePage() {
  return <Suspense fallback={<div>Loading...</div>}><GameContent /></Suspense>;
}
