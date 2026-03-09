// src/app/api/room/[roomId]/route.ts
import { NextResponse } from 'next/server';
import { store } from '@/lib/gameStore';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const { roomId } = await params;
    const room = store.getRoom(roomId);
    if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    return NextResponse.json(room);
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const body = await request.json();
    const { action, playerName, playerId, hint, targetId, guess } = body;
    const { roomId } = await params;

    switch (action) {
        case 'join':
            if (!playerName) return NextResponse.json({ error: 'Name required' }, { status: 400 });
            const joinResult = store.joinRoom(roomId, playerName);
            if (!joinResult) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
            return NextResponse.json(joinResult);

        case 'start':
            store.startGame(roomId);
            return NextResponse.json({ success: true });

        case 'hint':
            if (!playerId || !hint) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
            store.submitHint(roomId, playerId, hint);
            return NextResponse.json({ success: true });

        case 'vote':
            if (!playerId || !targetId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
            store.submitVote(roomId, playerId, targetId);
            return NextResponse.json({ success: true });

        case 'lastChance':
            if (!guess) return NextResponse.json({ error: 'Guess required' }, { status: 400 });
            store.imposterLastChance(roomId, guess);
            return NextResponse.json({ success: true });

        default:
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
}
