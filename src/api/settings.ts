import { SERVER_URL } from "./socket";
import { DEFAULT_SETTINGS, activeKeys, type Catalog, type RoomSettings, type SettingsPatch } from "./types";

/** Applies a partial settings patch locally (the server does the same). */
export const applySettingsPatch = (base: RoomSettings, patch: SettingsPatch): RoomSettings => ({
  ...base,
  ...patch,
  timers: { ...base.timers, ...patch.timers },
  actions: { ...base.actions, ...patch.actions },
  cards: { ...base.cards, ...patch.cards },
  scenario: { ...base.scenario, ...patch.scenario },
});

/** Action card is dealt: not removed by the host and has what it needs. */
export const actionAvailable = (settings: RoomSettings, catalog: Catalog, card: string) => {
  const needs = catalog.actionNeeds[card];
  const active = activeKeys(settings);
  return !settings.cards.disabledActions.includes(card) && (!needs || needs.some((key) => active.includes(key)));
};

let catalog: Promise<Catalog> | null = null;

/** GET /catalog, loaded once per page. */
export const loadCatalog = (): Promise<Catalog> => {
  catalog ??= fetch(`${SERVER_URL}/catalog`).then(
    (response) => {
      if (!response.ok) throw new Error("Не удалось загрузить карты и сценарии");
      return response.json() as Promise<Catalog>;
    },
    () => {
      throw new Error("Нет связи с сервером");
    },
  );
  catalog.catch(() => (catalog = null));
  return catalog;
};

// ---- settings file ---------------------------------------------------------

const FILE_FORMAT = "bunker-settings";
const FILE_VERSION = 1;

/** Game setup without what identifies a particular room. */
type GameSetup = Omit<RoomSettings, "title" | "isPublic">;

const SETUP_KEYS = ["mode", "maxPlayers", "timers", "actions", "seats", "cards", "scenario"] as const satisfies readonly (keyof GameSetup)[];

/** Downloads the game setup as a JSON file. */
export const exportSettings = (settings: RoomSettings) => {
  const setup = Object.fromEntries(SETUP_KEYS.map((key) => [key, settings[key]]));
  const file = { format: FILE_FORMAT, version: FILE_VERSION, settings: setup };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });

  const slug = settings.title.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `bunker-${slug || "settings"}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};

/**
 * Reads a settings file into a patch. Everything missing from the file is
 * reset to defaults, so importing always gives the same setup. The server
 * validates the values.
 */
export const readSettingsFile = async (file: File): Promise<SettingsPatch> => {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("Файл повреждён: это не JSON");
  }

  const body = data as { format?: unknown; version?: unknown; settings?: unknown } | null;
  if (body?.format !== FILE_FORMAT || typeof body.settings !== "object" || body.settings === null) {
    throw new Error("Это не файл настроек Бункера");
  }
  if (typeof body.version !== "number" || body.version > FILE_VERSION) {
    throw new Error("Файл создан в более новой версии игры");
  }

  const settings = body.settings as Partial<GameSetup>;
  return Object.fromEntries(SETUP_KEYS.map((key) => [key, settings[key] ?? DEFAULT_SETTINGS[key]])) as SettingsPatch;
};
