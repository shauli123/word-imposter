// src/lib/gameStore.ts

import { getRandomWord } from './words';

export type Role = 'group' | 'imposter';
export type Phase = 'lobby' | 'playing' | 'voting' | 'ended';

export interface Player {
    id: string;
    name: string;
    score: number;
    role: Role;
    hasVoted: boolean;
    hasHinted: boolean;
}

export interface Room {
    id: string;
    phase: Phase;
    players: Record<string, Player>;
    secretWord: string;
    categoryHint: string;
    imposterId: string | null;
    hints: Record<string, string>; // playerId -> hint
    votes: Record<string, string | 'skip'>; // playerId -> votedPlayerId or 'skip'
    turnOrder: string[]; // Order of players giving hints
    currentTurnIndex: number; // Who is currently giving a hint
    roundWinner: 'group' | 'imposter' | null;
    winReason: string | null;
    roundTimer: number | null;
}

class GameStore {
    private rooms: Map<string, Room> = new Map();

    createRoom(): string {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        this.rooms.set(roomId, {
            id: roomId,
            phase: 'lobby',
            players: {},
            secretWord: '',
            categoryHint: '',
            imposterId: null,
            hints: {},
            votes: {},
            turnOrder: [],
            currentTurnIndex: 0,
            roundWinner: null,
            winReason: null,
            roundTimer: null,
        });
        return roomId;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId.toUpperCase());
    }

    joinRoom(roomId: string, playerName: string): { roomId: string, playerId: string } | null {
        const room = this.getRoom(roomId);
        if (!room) return null;

        // Check if player name already exists to prevent duplicates
        const existingPlayerEntry = Object.entries(room.players).find(([_, p]) => p.name === playerName);
        if (existingPlayerEntry) {
            return { roomId: room.id, playerId: existingPlayerEntry[0] };
        }

        const playerId = Math.random().toString(36).substring(2, 10);
        room.players[playerId] = {
            id: playerId,
            name: playerName,
            score: 0,
            role: 'group',
            hasVoted: false,
            hasHinted: false,
        };
        return { roomId: room.id, playerId };
    }

    leaveRoom(roomId: string, playerId: string) {
        const room = this.getRoom(roomId);
        if (room && room.players[playerId]) {
            delete room.players[playerId];
            // If room is empty, we could delete it, but let's keep it simple
        }
    }

    startGame(roomId: string) {
        const room = this.getRoom(roomId);
        if (!room || Object.keys(room.players).length < 2) return; // Require at least 2 for testing, ideally 3+

        const { word, categoryHint } = getRandomWord();
        room.secretWord = word;
        room.categoryHint = categoryHint;

        const playerIds = Object.keys(room.players);
        const imposterIndex = Math.floor(Math.random() * playerIds.length);
        room.imposterId = playerIds[imposterIndex];

        // Reset state
        room.phase = 'playing';
        room.hints = {};
        room.votes = {};
        room.roundWinner = null;
        room.winReason = null;

        // Randomize turn order
        room.turnOrder = [...playerIds].sort(() => Math.random() - 0.5);
        room.currentTurnIndex = 0;

        // Assign roles
        for (const pid of playerIds) {
            room.players[pid].role = (pid === room.imposterId) ? 'imposter' : 'group';
            room.players[pid].hasVoted = false;
            room.players[pid].hasHinted = false;
        }
    }

    submitHint(roomId: string, playerId: string, hint: string) {
        const room = this.getRoom(roomId);
        if (!room || room.phase !== 'playing') return;

        const expectedPlayerId = room.turnOrder[room.currentTurnIndex];
        if (playerId !== expectedPlayerId) return; // Not their turn

        room.hints[playerId] = hint;
        room.players[playerId].hasHinted = true;

        // Check if imposter typed the secret word (or close to it)
        if (playerId === room.imposterId) {
            if (this.isCloseMatch(hint, room.secretWord)) {
                this.endRound(room, 'imposter', 'האימפוסטר ניחש את המילה החשווית במהלך הרמזים!');
                return;
            }
        }

        // Advance turn
        room.currentTurnIndex++;

        // If everyone hinted, move to voting
        if (room.currentTurnIndex >= room.turnOrder.length) {
            room.phase = 'voting';
        }
    }

    submitVote(roomId: string, playerId: string, targetId: string | 'skip') {
        const room = this.getRoom(roomId);
        if (!room || room.phase !== 'voting') return;

        room.votes[playerId] = targetId;
        room.players[playerId].hasVoted = true;

        const allVoted = Object.keys(room.players).every(pid => room.players[pid].hasVoted);
        if (allVoted) {
            this.resolveVoting(room);
        }
    }

    private resolveVoting(room: Room) {
        let skipCount = 0;
        const voteCounts: Record<string, number> = {};

        for (const v of Object.values(room.votes)) {
            if (v === 'skip') {
                skipCount++;
            } else {
                voteCounts[v] = (voteCounts[v] || 0) + 1;
            }
        }

        const playerIds = Object.keys(room.players);
        const majorityThreshold = Math.floor(playerIds.length / 2) + 1;

        if (skipCount >= majorityThreshold) {
            // Skipped, go back to playing if there's no auto-win conditions yet
            // For simplicity, skip just moves to next round of hints
            room.phase = 'playing';
            room.currentTurnIndex = 0;
            for (const pid of playerIds) {
                room.players[pid].hasHinted = false;
                room.players[pid].hasVoted = false;
            }
            room.hints = {};
            room.votes = {};
            return;
        }

        // Find who got most votes
        let highestVotes = 0;
        let eliminatedId: string | null = null;

        for (const [pid, count] of Object.entries(voteCounts)) {
            if (count > highestVotes) {
                highestVotes = count;
                eliminatedId = pid;
            }
        }

        // Assign points for correct votes
        for (const [pid, vote] of Object.entries(room.votes)) {
            if (vote === room.imposterId && pid !== room.imposterId) {
                room.players[pid].score += 10;
            }
        }

        if (eliminatedId === room.imposterId) {
            // Imposter caught. They have one last chance to guess.
            // We will handle this in UI, but for store, let's say Group wins if imposter doesn't do "last chance guess"
            // Let's implement Last Chance in V1.5, for now Group wins outright.
            this.endRound(room, 'group', 'הקבוצה תפסה את האימפוסטר בהצלחה!');
        } else {
            // Wrong person eliminated. Eliminate them from game? Or Imposter wins?
            // Rules: Imposter wins if they survive until it's 1vs1.
            // Here let's just say if wrong person voted, game continues or imposter wins?
            // For simplicity in this fast prototype: Imposter wins if group votes wrong person.
            this.endRound(room, 'imposter', 'הקבוצה הצביעה על האדם הלא נכון. האימפוסטר ניצח!');
        }
    }

    imposterLastChance(roomId: string, guess: string) {
        const room = this.getRoom(roomId);
        if (!room || room.phase !== 'ended') return;
        if (this.isCloseMatch(guess, room.secretWord)) {
            room.roundWinner = 'imposter';
            room.winReason = 'האימפוסטר הודח הניחש נכונה בהזדמנות האחרונה!';
            room.players[room.imposterId!].score += 20;
        }
    }

    private endRound(room: Room, winner: 'group' | 'imposter', reason: string) {
        room.phase = 'ended';
        room.roundWinner = winner;
        room.winReason = reason;

        if (winner === 'imposter' && room.imposterId) {
            room.players[room.imposterId].score += 50;
        } else {
            // Group points already awarded during voting.
        }
    }

    // Basic Levenshtein distance for typos - max 1 typo allowed for short words, 2 for long
    private isCloseMatch(input: string, target: string): boolean {
        const a = input.trim().toLowerCase();
        const b = target.trim().toLowerCase();
        if (a === b) return true;

        if (a.length < 3) return a === b;

        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i += 1) { matrix[0][i] = i; }
        for (let j = 0; j <= b.length; j += 1) { matrix[j][0] = j; }

        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }

        const distance = matrix[b.length][a.length];
        const allowedTypos = target.length > 5 ? 2 : 1;
        return distance <= allowedTypos;
    }
}

// Ensure global scope for NextJS hot-reloading
const globalForGameStore = globalThis as unknown as { store: GameStore };
export const store = globalForGameStore.store || new GameStore();
if (process.env.NODE_ENV !== 'production') globalForGameStore.store = store;
