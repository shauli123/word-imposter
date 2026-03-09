// src/app/api/room/[roomId]/view/[playerId]/route.ts
import { NextResponse } from 'next/server';
import { store } from '@/lib/gameStore';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ roomId: string; playerId: string }> }
) {
    const { roomId, playerId } = await params;
    const room = store.getRoom(roomId);
    if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const player = room.players[playerId];

    // Build a player-specific view of the room
    const view = {
        ...room,
        // Only show the secret word to the correct player
        secretWord: player?.role === 'group' ? room.secretWord : '',
        categoryHint: player?.role === 'imposter' ? room.categoryHint : '',
        // Never expose who the imposter is (except at round end)
        imposterId: room.phase === 'ended' ? room.imposterId : null,
        myRole: player?.role ?? 'group',
        isMyTurn: room.phase === 'playing' && room.turnOrder[room.currentTurnIndex] === playerId,
    };

    return NextResponse.json(view);
}
