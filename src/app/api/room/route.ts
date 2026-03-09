// src/app/api/room/route.ts
import { NextResponse } from 'next/server';
import { store } from '@/lib/gameStore';

export async function POST() {
    const roomId = store.createRoom();
    return NextResponse.json({ roomId });
}
