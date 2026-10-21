import { useEffect, useState } from "react";

import { fetchRooms, type RoomFilters, type RoomsPage } from "../api/rooms";
import { request, socket } from "../api/socket";

interface Loaded {
  key: string;
  page: RoomsPage | null;
  error: string | null;
}

/**
 * Public rooms matching `filters`. Refetches when filters change and when
 * the server signals `rooms:changed`; stale requests are aborted.
 */
export function usePublicRooms(filters: RoomFilters) {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Live updates: the server only says "something changed", we refetch.
  useEffect(() => {
    const watch = () => void request("rooms:watch").catch(() => undefined);
    const refresh = () => setVersion((v) => v + 1);
    const onConnect = () => {
      watch();
      refresh();
    };

    if (socket.connected) watch();
    socket.on("connect", onConnect);
    socket.on("rooms:changed", refresh);

    return () => {
      socket.off("connect", onConnect);
      socket.off("rooms:changed", refresh);
      if (socket.connected) void request("rooms:unwatch").catch(() => undefined);
    };
  }, []);

  const key = JSON.stringify([filters, version]);

  useEffect(() => {
    const controller = new AbortController();

    fetchRooms(filters, controller.signal)
      .then((page) => setLoaded({ key, page, error: null }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded((prev) => ({
          key,
          page: prev?.page ?? null,
          error: e instanceof Error ? e.message : "Не удалось загрузить комнаты",
        }));
      });

    return () => controller.abort();
    // `key` covers filters and version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    rooms: loaded?.page?.rooms ?? [],
    total: loaded?.page?.total ?? 0,
    error: loaded?.error ?? null,
    retry: () => setVersion((v) => v + 1),
    /** First load, or filters changed and the new result isn't here yet. */
    loading: loaded?.key !== key,
    initialLoading: loaded === null,
  };
}
