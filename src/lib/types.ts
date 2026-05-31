// Shared domain types for Decrypt. Mirrors the Postgres schema (see SCHEMA.md) and the
// generated row types in database.types.ts.

export type TeamColor = 'cyan' | 'amber' | 'none';
export type GameTeam = 'cyan' | 'amber';
export type PlayerRole = 'spymaster' | 'operative' | 'none';
export type RoomStatus = 'lobby' | 'in_game' | 'finished';
export type GamePhase = 'clue' | 'guess' | 'finished';
export type CardIdentity = 'cyan' | 'amber' | 'neutral' | 'assassin';

export interface Room {
  id: string;
  code: string;
  host_player_id: string | null;
  status: RoomStatus;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  auth_user_id: string;
  display_name: string;
  team: TeamColor;
  role: PlayerRole;
  is_host: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface Game {
  id: string;
  room_id: string;
  starting_team: GameTeam;
  current_team: GameTeam;
  phase: GamePhase;
  winner: GameTeam | null;
  turn_deadline: string;
  cyan_remaining: number;
  amber_remaining: number;
  guesses_remaining: number;
  current_clue_id: string | null;
  created_at: string;
}

export interface Card {
  id: string;
  game_id: string;
  position: number;
  word: string;
  revealed: boolean;
  revealed_identity: CardIdentity | null;
  revealed_by_team: TeamColor | null;
  revealed_at: string | null;
}

export interface CardKey {
  card_id: string;
  game_id: string;
  identity: CardIdentity;
}

export interface Clue {
  id: string;
  game_id: string;
  team: GameTeam;
  word: string;
  number: number;
  created_at: string;
}

// Typed error envelope returned by every Edge Function on failure.
export type GameErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_A_MEMBER'
  | 'NOT_HOST'
  | 'NOT_YOUR_TURN'
  | 'WRONG_ROLE'
  | 'WRONG_PHASE'
  | 'INVALID_CLUE'
  | 'INVALID_INPUT'
  | 'ROSTER_INCOMPLETE'
  | 'ROOM_NOT_FOUND'
  | 'GAME_NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'ALREADY_REVEALED'
  | 'ALREADY_STARTED'
  | 'INTERNAL';

export interface GameError {
  error: GameErrorCode;
  message: string;
}
