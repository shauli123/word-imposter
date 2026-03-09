"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  Send,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Trophy
} from 'lucide-react';

interface Player {
  id: string;
  name: string;
  score: number;
  role: 'group' | 'imposter';
  hasVoted: boolean;
  hasHinted: boolean;
}

interface RoomView {
  id: string;
  phase: 'lobby' | 'playing' | 'voting' | 'ended';
  players: Record<string, Player>;
  // These are filtered server-side per player
  secretWord: string;
  categoryHint: string;
  imposterId: string | null;
  hints: Record<string, string>;
  votes: Record<string, string | 'skip'>;
  turnOrder: string[];
  currentTurnIndex: number;
  roundWinner: 'group' | 'imposter' | null;
  winReason: string | null;
  myRole: 'group' | 'imposter';
  isMyTurn: boolean;
}

export default function GameRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<RoomView | null>(null);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [hintInput, setHintInput] = useState('');
  const [lastChanceGuess, setLastChanceGuess] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const myIdRef = useRef<string | null>(null);

  // On load: always re-join so we get a fresh, valid playerId
  useEffect(() => {
    const saved = localStorage.getItem(`room_${roomId}`);
    if (!saved) {
      router.push('/');
      return;
    }
    const { playerName } = JSON.parse(saved) as { playerName: string; playerId?: string };

    fetch(`/api/room/${roomId}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'join', playerName }),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => {
        if (!res.ok) throw new Error('לא ניתן להצטרף לחדר');
        return res.json();
      })
      .then(({ playerId }) => {
        // Persist the new (valid) playerId
        localStorage.setItem(`room_${roomId}`, JSON.stringify({ playerName, playerId }));
        myIdRef.current = playerId;
        setMe({ id: playerId, name: playerName });
        setReady(true);
      })
      .catch(() => setError('לא ניתן להצטרף לחדר'));
  }, [roomId, router]);

  // Polling – using the player-specific endpoint
  const fetchRoom = useCallback(async () => {
    const myId = myIdRef.current;
    if (!myId) return;
    try {
      const res = await fetch(`/api/room/${roomId}/view/${myId}`);
      if (!res.ok) throw new Error();
      setRoom(await res.json());
    } catch {
      setError('אבד החיבור לחדר');
    }
  }, [roomId]);

  useEffect(() => {
    if (!ready) return;
    fetchRoom();
    const interval = setInterval(fetchRoom, 1500);
    return () => clearInterval(interval);
  }, [fetchRoom, ready]);

  const action = useCallback(async (body: object) => {
    await fetch(`/api/room/${roomId}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    fetchRoom();
  }, [roomId, fetchRoom]);

  const startGame = () => action({ action: 'start' });

  const submitHint = async () => {
    if (!hintInput || !me) return;
    await action({ action: 'hint', playerId: me.id, hint: hintInput });
    setHintInput('');
  };

  const submitVote = (targetId: string | 'skip') => {
    if (!me) return;
    action({ action: 'vote', playerId: me.id, targetId });
  };

  const submitLastChance = async () => {
    if (!lastChanceGuess) return;
    await action({ action: 'lastChance', guess: lastChanceGuess });
    setLastChanceGuess('');
  };

  // Error / loading states
  if (error) return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="glass p-8 space-y-4">
        <AlertCircle className="mx-auto text-rose-500" size={48} />
        <h2 className="text-2xl font-bold">{error}</h2>
        <button onClick={() => router.push('/')} className="glow-button">חזרה למסך הבית</button>
      </div>
    </div>
  );

  if (!room || !me) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-violet-400 animate-pulse text-xl">מתחבר לחדר...</div>
    </div>
  );

  const myPlayer = room.players[me.id];
  const iAmImposter = room.myRole === 'imposter';
  const isMyTurn = room.isMyTurn;
  const mySecretInfo = iAmImposter ? room.categoryHint : room.secretWord;

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center glass p-4 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center font-bold text-white">
            {me.name?.charAt(0) || '?'}
          </div>
          <div>
            <div className="text-sm text-gray-400">השחקן שלך</div>
            <div className="font-bold flex items-center gap-2">
              {me.name}
              {iAmImposter && room.phase !== 'lobby' && (
                <ShieldAlert size={14} className="text-rose-500" />
              )}
            </div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-widest">קוד חדר</div>
          <div className="text-2xl font-black text-violet-400 leading-none">{roomId}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">ניקוד</div>
          <div className="font-bold text-xl">{myPlayer?.score ?? 0}</div>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 flex flex-col gap-6">

        {/* ── LOBBY ── */}
        {room.phase === 'lobby' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass p-8 flex-1 flex flex-col items-center justify-center text-center space-y-8">
            <Users size={64} className="text-violet-500 opacity-50" />
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">ממתינים לשחקנים...</h2>
              <p className="text-gray-400">לפחות 3 שחקנים מומלצים לחוויה הטובה ביותר</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {Object.values(room.players).map(p => (
                <div key={p.id} className="bg-white/10 px-4 py-2 rounded-full border border-white/5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {p.name}
                  {p.id === me.id && <span className="text-xs opacity-50">(אני)</span>}
                </div>
              ))}
            </div>
            <button onClick={startGame} className="glow-button px-12 py-4 text-xl flex items-center gap-3">
              <ArrowRight size={24} />
              מתחילים בערפל
            </button>
          </motion.div>
        )}

        {/* ── PLAYING ── */}
        {room.phase === 'playing' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">

              {/* Secret card */}
              {mySecretInfo && (
                <div className={`glass p-6 overflow-hidden relative border ${iAmImposter ? 'border-rose-500/40' : 'border-violet-500/40'}`}>
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <HelpCircle size={100} />
                  </div>
                  <h3 className="text-lg text-gray-400 mb-2">
                    {iAmImposter ? '🎭 הקטגוריה שלך (אתה האימפוסטר):' : '🔐 המילה הסודית שלך:'}
                  </h3>
                  <div className={`text-5xl font-black title-gradient ${iAmImposter ? 'from-rose-400 to-orange-400' : ''}`}>
                    {mySecretInfo}
                  </div>
                  {iAmImposter && (
                    <p className="mt-3 text-sm text-gray-500">הקבוצה יודעת את המילה. אתה רק יודע את הקטגוריה. נסה לנחש!</p>
                  )}
                </div>
              )}

              {/* Hints Wall */}
              <div className="glass p-6 space-y-4">
                <h3 className="flex items-center gap-2 text-gray-400 font-bold">
                  <Send size={16} />
                  רמזים שניתנו
                </h3>
                <div className="space-y-3">
                  {room.turnOrder.map((pid, idx) => {
                    const p = room.players[pid];
                    const hint = room.hints[pid];
                    const isCurrent = idx === room.currentTurnIndex;
                    return (
                      <div key={pid}
                        className={`flex items-center gap-4 p-3 rounded-2xl transition-all ${isCurrent ? 'bg-violet-500/20 ring-1 ring-violet-500/50' : 'bg-white/5'}`}>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {p?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500">{p?.name || 'שחקן שעזב'}</div>
                          <div className="text-lg font-medium truncate">
                            {hint
                              ? hint
                              : isCurrent
                                ? '✏️ כותב/ת עכשיו...'
                                : 'ממתינים...'}
                          </div>
                        </div>
                        {hint && <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />}
                        {isCurrent && !hint && pid === me.id && (
                          <div className="text-xs text-violet-400 flex-shrink-0 animate-pulse">תורך!</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Side panel */}
            <div className="space-y-6">
              <div className="glass p-6">
                {isMyTurn ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-violet-400">
                      <Send size={20} />
                      תורך לתת רמז!
                    </h3>
                    {iAmImposter && (
                      <p className="text-xs text-rose-300 bg-rose-500/10 p-2 rounded-lg">
                        💡 אם תקליד את המילה הסודית הנכונה — תנצח מיד!
                      </p>
                    )}
                    <input
                      type="text"
                      className="input-field text-center text-2xl"
                      autoFocus
                      placeholder="מילה אחת..."
                      value={hintInput}
                      onChange={e => setHintInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitHint()}
                    />
                    <button onClick={submitHint} className="glow-button w-full">
                      שלח רמז
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-3">
                    <div className="relative inline-block">
                      <Users size={48} className="text-gray-600" />
                      <div className="absolute top-0 right-0 -mr-2 -mt-2 bg-violet-600 text-white rounded-full p-1 animate-bounce">
                        <ArrowRight size={12} />
                      </div>
                    </div>
                    <h4 className="font-bold">
                      תורו של {room.players[room.turnOrder[room.currentTurnIndex]]?.name ?? '...'}
                    </h4>
                    <p className="text-sm text-gray-500">שימו לב לרמזים — מישהו פה לא יודע את המילה!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── VOTING ── */}
        {room.phase === 'voting' && (
          <div className="space-y-6">
            <div className="glass p-8 text-center space-y-4">
              <h2 className="text-4xl font-black title-gradient">הצבעה!</h2>
              <p className="text-xl">מי נראה לכם כמו האימפוסטר?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(room.players).map(p => {
                const myVote = room.votes[me.id];
                const hasVoted = !!myVote;
                const isMe = p.id === me.id;
                return (
                  <button
                    key={p.id}
                    disabled={hasVoted || isMe}
                    onClick={() => submitVote(p.id)}
                    className={`glass p-6 text-right flex items-center justify-between transition-all ${myVote === p.id ? 'ring-2 ring-violet-500' : hasVoted || isMe ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold">
                        {p.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-xl font-bold">{p.name}</div>
                        <div className="text-sm text-gray-400 italic">
                          &ldquo;{room.hints[p.id] ?? '...'}&rdquo;
                        </div>
                      </div>
                    </div>
                    {myVote === p.id && <CheckCircle2 className="text-violet-500" />}
                    {isMe && <span className="text-xs text-gray-500">(אני)</span>}
                  </button>
                );
              })}
              <button
                disabled={!!room.votes[me.id]}
                onClick={() => submitVote('skip')}
                className={`glass p-6 text-center font-bold transition-all ${room.votes[me.id] === 'skip' ? 'ring-2 ring-gray-500' : !!room.votes[me.id] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}`}
              >
                ⏭️ דלג (Skip) — המשיכו לסיבוב הבא
              </button>
            </div>
            <div className="text-center text-gray-500">
              {Object.values(room.players).filter(p => p.hasVoted).length} / {Object.keys(room.players).length} הצביעו
            </div>
          </div>
        )}

        {/* ── ENDED ── */}
        {room.phase === 'ended' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass p-12 text-center space-y-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-violet-600/5 pointer-events-none" />

            {room.roundWinner === 'group' ? (
              <div className="space-y-4">
                <CheckCircle2 size={80} className="mx-auto text-green-500" />
                <h2 className="text-6xl font-black text-green-500">הקבוצה ניצחה! 🎉</h2>
              </div>
            ) : (
              <div className="space-y-4">
                <ShieldAlert size={80} className="mx-auto text-rose-500" />
                <h2 className="text-6xl font-black text-rose-500">האימפוסטר ניצח! 🕵️</h2>
              </div>
            )}

            <div className="bg-white/5 p-6 rounded-3xl space-y-3">
              <p className="text-xl text-gray-300">{room.winReason}</p>
              <div className="text-2xl mt-2">
                המילה הייתה: <span className="font-bold text-violet-400">{room.secretWord || room.categoryHint}</span>
              </div>
              {room.imposterId && (
                <div className="text-lg">
                  האימפוסטר היה: <span className="font-bold text-rose-400">{room.players[room.imposterId]?.name}</span>
                </div>
              )}
            </div>

            {/* Last Chance: only shown to the imposter if group won */}
            {room.roundWinner === 'group' && iAmImposter && (
              <div className="glass p-6 bg-rose-500/10 border border-rose-500/30 space-y-4 max-w-md mx-auto">
                <h3 className="font-bold text-rose-400 text-xl">⚡ הזדמנות אחרונה!</h3>
                <p className="text-sm text-gray-300">נחשת מה הייתה המילה? הגש עכשיו ותנצח!</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="מה הייתה המילה הסודית?"
                    value={lastChanceGuess}
                    onChange={e => setLastChanceGuess(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitLastChance()}
                  />
                  <button onClick={submitLastChance} className="glow-button whitespace-nowrap">נחש!</button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
                <Trophy className="text-yellow-500" />
                לוח ניקוד
              </h3>
              <div className="flex flex-col gap-2 max-w-sm mx-auto">
                {Object.values(room.players).sort((a, b) => b.score - a.score).map((p, idx) => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <span className="flex items-center gap-2">
                      <span className="opacity-40 w-5">#{idx + 1}</span>
                      {p.name}
                      {p.id === me.id && <span className="text-xs text-violet-400">(אני)</span>}
                    </span>
                    <span className="font-bold">{p.score} pt</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={startGame} className="glow-button px-12 py-4 text-xl">
              🔄 סיבוב נוסף!
            </button>
          </motion.div>
        )}
      </div>
    </main>
  );
}
