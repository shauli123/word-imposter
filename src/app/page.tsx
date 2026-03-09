"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Users, Search } from 'lucide-react';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomToJoin, setRoomToJoin] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createRoom = async () => {
    if (!playerName) return alert('נא להזין שם!');
    setLoading(true);
    try {
      const res = await fetch('/api/room', { method: 'POST' });
      const { roomId } = await res.json();

      const joinRes = await fetch(`/api/room/${roomId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'join', playerName }),
        headers: { 'Content-Type': 'application/json' }
      });
      const { playerId } = await joinRes.json();

      localStorage.setItem(`room_${roomId}`, JSON.stringify({ playerId, playerName }));
      router.push(`/${roomId}`);
    } catch (e) {
      alert('שגיאה ביצירת חדר');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const cleanRoomId = roomToJoin.trim().toUpperCase();
    if (!playerName || !cleanRoomId) return alert('נא להזין שם וקוד חדר!');
    setLoading(true);
    try {
      const joinRes = await fetch(`/api/room/${cleanRoomId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'join', playerName }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!joinRes.ok) {
        throw new Error('חדר לא נמצא');
      }

      const { playerId } = await joinRes.json();
      localStorage.setItem(`room_${cleanRoomId}`, JSON.stringify({ playerId, playerName }));
      router.push(`/${cleanRoomId}`);
    } catch (e) {
      alert('החדר לא קיים או שגיאה בחיבור');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 space-y-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-6xl md:text-8xl title-gradient py-2">מילה בערפל</h1>
        <p className="text-xl text-gray-400">משחק חברתי של רמזים, חשדות וניבויים</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="glass p-8 w-full max-w-md space-y-8"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 block">השם שלך</label>
          <input
            type="text"
            placeholder="איך יקראו לך?"
            className="input-field text-xl text-center"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>

        <div className="pt-4 border-t border-white/10 space-y-4">
          <button
            disabled={loading}
            onClick={createRoom}
            className="glow-button w-full flex items-center justify-center gap-2 text-lg"
          >
            <Sparkles size={20} />
            יצירת חדר חדש
          </button>

          <div className="relative flex items-center justify-center py-2 text-gray-500 uppercase text-xs font-bold">
            <span className="bg-[#0a0a0c] px-4 z-10">או הצטרפות לחדר</span>
            <hr className="absolute w-full border-white/5" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="קוד חדר (למשל ABCD)"
              className="input-field text-center uppercase tracking-widest"
              value={roomToJoin}
              onChange={(e) => setRoomToJoin(e.target.value)}
            />
            <button
              disabled={loading}
              onClick={joinRoom}
              className="bg-white/10 hover:bg-white/15 px-6 rounded-xl transition-all"
            >
              <Users size={20} />
            </button>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-8 text-gray-500 text-sm">
        <div className="flex items-center gap-2"><Sparkles size={14} /> אלפי מילים</div>
        <div className="flex items-center gap-2"><Users size={14} /> מולטיפלייר</div>
        <div className="flex items-center gap-2"><Search size={14} /> זיהוי שגיאות כתיב</div>
      </div>
    </main>
  );
}
