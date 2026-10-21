import { SERVER_URL } from "./socket";
import type { GameMode, PublicRoomSummary } from "./types";

export type RoomSort = "popular" | "new";

export interface RoomFilters {
  q: string;
  mode: GameMode | "";
  freeSlots: boolean;
  sort: RoomSort;
}

export const DEFAULT_FILTERS: RoomFilters = {
  q: "",
  mode: "",
  freeSlots: false,
  sort: "popular",
};

export interface RoomsPage {
  rooms: PublicRoomSummary[];
  total: number;
}

/** GET /rooms with filters as query params. */
export async function fetchRooms(filters: RoomFilters, signal?: AbortSignal): Promise<RoomsPage> {
  const params = new URLSearchParams({ sort: filters.sort });
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.freeSlots) params.set("freeSlots", "1");

  let response: Response;
  try {
    response = await fetch(`${SERVER_URL}/rooms?${params}`, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    // fetch only throws on network failures — the server is down or unreachable.
    throw new Error("Нет связи с сервером", { cause: e });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Не удалось загрузить комнаты");
  }
  return response.json();
}
