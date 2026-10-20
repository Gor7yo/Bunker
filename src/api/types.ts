// Mirrors the server contracts (bunker-server-nesjs/src/modules/room/room.types.ts).

export const CARD_KEYS = [
  "gender",
  "age",
  "profession",
  "health",
  "phobia",
  "hobby",
  "baggage",
  "fact",
  "action",
] as const;

export type CardKey = (typeof CARD_KEYS)[number];

/** Characteristics left out of the game are absent. */
export type PlayerCard = Partial<Record<CardKey, string>>;

export const CARD_LABELS: Record<CardKey, string> = {
  gender: "Пол",
  age: "Возраст",
  profession: "Профессия",
  health: "Здоровье",
  phobia: "Фобия",
  hobby: "Хобби",
  baggage: "Багаж",
  fact: "Факт",
  action: "Действие",
};

export type GameMode = "AUTO" | "MODERATED";
export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";
export type PlayerRole = "PLAYER" | "MODERATOR";

export interface RoomTimers {
  reveal: number;
  discussion: number;
  voting: number;
  defense: number;
}

export type ActionTiming = "ANYTIME" | "OWN_TURN";
export type ActionApproval = "AUTO" | "MODERATOR";

export interface ActionRules {
  timing: ActionTiming;
  approval: ActionApproval;
}

export interface CardItem {
  value: string;
  description?: string;
}

/** Characteristics that can have custom values (action cards have mechanics). */
export type CustomCardKey = Exclude<CardKey, "action">;

export interface CustomDeck {
  /** true — only these values; false — added to the built-in ones. */
  replace: boolean;
  items: CardItem[];
}

export interface CardRules {
  /** Characteristics left out of the game. */
  disabled: CardKey[];
  /** Action cards (by name) removed from the deck. */
  disabledActions: string[];
  custom: Partial<Record<CustomCardKey, CustomDeck>>;
}

export type CatastropheText = Omit<Catastrophe, "id">;
export type BunkerText = Omit<Bunker, "id">;

export type ScenarioChoice<T> = { kind: "RANDOM" } | { kind: "PRESET"; id: string } | { kind: "CUSTOM"; value: T };

export interface ScenarioRules {
  catastrophe: ScenarioChoice<CatastropheText>;
  bunker: ScenarioChoice<BunkerText>;
}

export interface RoomSettings {
  title: string;
  isPublic: boolean;
  mode: GameMode;
  maxPlayers: number;
  timers: RoomTimers;
  actions: ActionRules;
  /** Bunker seats; null — half of the players, rounded down. */
  seats: number | null;
  cards: CardRules;
  scenario: ScenarioRules;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  title: "",
  isPublic: true,
  mode: "AUTO",
  maxPlayers: 12,
  timers: { reveal: 60, discussion: 180, voting: 30, defense: 45 },
  actions: { timing: "ANYTIME", approval: "AUTO" },
  seats: null,
  cards: { disabled: [], disabledActions: [], custom: {} },
  scenario: { catastrophe: { kind: "RANDOM" }, bunker: { kind: "RANDOM" } },
};

/** Characteristics dealt in a room, in card order. */
export const activeKeys = (settings: RoomSettings): CardKey[] =>
  CARD_KEYS.filter((key) => !settings.cards.disabled.includes(key));

/** Built-in game content, GET /catalog. */
export interface Catalog {
  catastrophes: Catastrophe[];
  bunkers: Omit<Bunker, "features">[];
  bunkerFeatures: string[];
  cards: Record<CardKey, CardItem[]>;
  /** Action card → characteristics it needs (any of them). */
  actionNeeds: Record<string, CardKey[]>;
  limits: {
    items: number;
    value: number;
    description: number;
    title: number;
    text: number;
    short: number;
    features: number;
    feature: number;
  };
}

export const TITLE_MAX_LENGTH = 40;
export const NAME_MAX_LENGTH = 20;

export interface PublicRoomSummary {
  code: string;
  title: string;
  mode: GameMode;
  hostName: string;
  players: number;
  maxPlayers: number;
}

export type SettingsPatch = Partial<Omit<RoomSettings, "timers" | "actions" | "cards" | "scenario">> & {
  timers?: Partial<RoomTimers>;
  actions?: Partial<ActionRules>;
  cards?: Partial<CardRules>;
  scenario?: Partial<ScenarioRules>;
};

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  role: PlayerRole;
  isReady: boolean;
  isOnline: boolean;
  isAlive: boolean;
  hasLeft: boolean;
  revealed: Partial<PlayerCard>;
  /** Hidden values the viewer saw privately (Проверка досье, Тайное знание). */
  known?: Partial<PlayerCard>;
  card?: PlayerCard;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  meId: string;
  myCard: PlayerCard | null;
  myRevealed: CardKey[];
  players: PublicPlayer[];
  /** Card value → description, for tooltips. */
  hints: Record<string, string>;
  game: GameView | null;
}

export interface SessionData {
  code: string;
  token: string;
}

// ---- game -----------------------------------------------------------------

export type GamePhase =
  | "INTRO"
  | "REVEAL"
  | "DISCUSSION"
  | "VOTING"
  | "DEFENSE"
  | "VOTE_RESULT"
  | "EXILE"
  | "FINISHED";

export interface Catastrophe {
  id: string;
  title: string;
  description: string;
  stay: string;
}

export interface Bunker {
  id: string;
  title: string;
  description: string;
  area: string;
  supplies: string;
  features: string[];
}

export interface VoteResult {
  votes: Record<string, string>;
  tally: Record<string, number>;
  leaders: string[];
}

export interface GameLogEntry {
  at: number;
  text: string;
  tone: "info" | "reveal" | "vote" | "exile";
}

export interface GameView {
  catastrophe: Catastrophe;
  bunker: Bunker;
  seats: number;
  round: number;
  phase: GamePhase;
  phaseEndsAt: number | null;
  serverNow: number;
  speakerId: string | null;
  turnQueue: string[];
  revealedThisTurn: boolean;
  candidates: string[];
  isRevote: boolean;
  readyToVote: string[];
  votedIds: string[];
  myVote: string | null;
  liveVotes: Record<string, string> | null;
  lastVote: VoteResult | null;
  lastExiledId: string | null;
  exiledByLot: boolean;
  requiredKey: CardKey | null;
  aliveCount: number;
  log: GameLogEntry[];
  myAction: MyAction | null;
  silenced: string[];
  immune: string[];
  confession: { targetId: string; byId: string } | null;
  pendingActions: PendingAction[];
}

export interface MyAction {
  value: string;
  description: string | null;
  target: "none" | "player" | "playerKey" | "twoPlayers" | "exiled";
  keys: CardKey[];
  allowSelf: boolean;
  used: boolean;
  pending: boolean;
  blockedReason: string | null;
}

export interface ActionParams {
  targetId?: string;
  otherId?: string;
  key?: CardKey;
}

export interface PendingAction {
  id: string;
  playerId: string;
  params: ActionParams;
  value: string;
  description: string | null;
}
