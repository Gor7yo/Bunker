import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bot, DoorOpen, Gavel, Plus, Radiation, RotateCw, Search, Undo2, Users, WifiOff, X } from "lucide-react";

import { DEFAULT_FILTERS, type RoomFilters, type RoomSort } from "../../api/rooms";
import { NAME_MAX_LENGTH, type GameMode, type PublicRoomSummary } from "../../api/types";
import { Alert, Badge, Button, Field, Input, Page, Panel, Select, Spinner, cx } from "../../components/ui";
import { useAction } from "../../hooks/useAction";
import { usePublicRooms } from "../../hooks/usePublicRooms";
import { roomStore } from "../../store/roomStore";
import { loadName, saveName } from "../../store/storage";
import styles from "./Home.module.css";

const SEARCH_DEBOUNCE_MS = 300;

const MODE_FILTERS: { value: GameMode | ""; label: string }[] = [
  { value: "", label: "Все" },
  { value: "AUTO", label: "Авто" },
  { value: "MODERATED", label: "С ведущим" },
];

/** Filters live in the URL: ?q=&mode=&free=1&sort=new */
const filtersFromParams = (params: URLSearchParams): RoomFilters => {
  const mode = params.get("mode");
  return {
    q: params.get("q") ?? "",
    mode: mode === "AUTO" || mode === "MODERATED" ? mode : "",
    freeSlots: params.get("free") === "1",
    sort: params.get("sort") === "new" ? "new" : "popular",
  };
};

const filtersToParams = (filters: RoomFilters) => {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.freeSlots) params.set("free", "1");
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  return params;
};

export const Home = observer(() => {
  const navigate = useNavigate();
  const { run, pending, error, setError } = useAction();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(loadName);
  const [code, setCode] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromParams(searchParams);
  const updateFilters = (patch: Partial<RoomFilters>) =>
    setSearchParams(filtersToParams({ ...filters, ...patch }), { replace: true });

  const { view, connected, notice } = roomStore;

  const changeName = (value: string) => {
    setName(value);
    saveName(value.trim());
  };

  const joinRoom = (roomCode: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Сначала введите позывной");
      nameRef.current?.focus();
      return;
    }
    void run(async () => navigate(`/room/${await roomStore.join(roomCode, trimmed)}`));
  };

  return (
    <Page>
      <header className={styles.hero}>
        <div className={styles.brand}>
          <Radiation size={40} className={styles.logoIcon} aria-hidden />
          <h1 className={styles.logo}>Бункер</h1>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => navigate("/create")}>
          Создать комнату
        </Button>
      </header>

      {notice && (
        <Alert tone="info" onClose={roomStore.dismissNotice}>
          {notice}
        </Alert>
      )}

      {view && (
        <Button variant="success" block icon={<Undo2 size={18} />} onClick={() => navigate(`/room/${view.code}`)}>
          Вернуться в комнату {view.code}
        </Button>
      )}

      <Panel accent>
        <div className={styles.entry}>
          <Field label="Позывной">
            <Input
              ref={nameRef}
              placeholder="Например, Меченый"
              maxLength={NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => changeName(e.target.value)}
            />
          </Field>
          <form
            className={styles.codeForm}
            onSubmit={(e) => {
              e.preventDefault();
              joinRoom(code);
            }}
          >
            <Field label="Код приватной комнаты">
              <Input
                className={styles.codeInput}
                placeholder="КОД"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              />
            </Field>
            <Button type="submit" icon={<DoorOpen size={16} />} disabled={pending || !connected || !code}>
              Войти
            </Button>
          </form>
        </div>
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      </Panel>

      <PublicRooms
        filters={filters}
        onFiltersChange={updateFilters}
        disabled={pending || !connected}
        onJoin={joinRoom}
      />
    </Page>
  );
});

interface PublicRoomsProps {
  filters: RoomFilters;
  onFiltersChange: (patch: Partial<RoomFilters>) => void;
  disabled: boolean;
  onJoin: (code: string) => void;
}

const PublicRooms = ({ filters, onFiltersChange, disabled, onJoin }: PublicRoomsProps) => {
  const { rooms, total, loading, initialLoading, error, retry } = usePublicRooms(filters);
  const hasFilters = filters.q !== "" || filters.mode !== "" || filters.freeSlots;

  return (
    <Panel
      title="Открытые комнаты"
      icon={<Users size={18} />}
      actions={
        <span className={styles.found}>
          {loading && !initialLoading && <Spinner size={14} />}
          найдено: {total}
        </span>
      }
    >
      <div className={styles.filters}>
        <SearchInput value={filters.q} onChange={(q) => onFiltersChange({ q })} />

        <div className={styles.segmented} role="radiogroup" aria-label="Режим">
          {MODE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={filters.mode === option.value}
              className={cx(styles.segment, filters.mode === option.value && styles.segmentActive)}
              onClick={() => onFiltersChange({ mode: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={filters.freeSlots}
            onChange={(e) => onFiltersChange({ freeSlots: e.target.checked })}
          />
          Есть места
        </label>

        <Select
          className={styles.sort}
          aria-label="Сортировка"
          value={filters.sort}
          onChange={(e) => onFiltersChange({ sort: e.target.value as RoomSort })}
        >
          <option value="popular">Сначала заполненные</option>
          <option value="new">Сначала новые</option>
        </Select>
      </div>

      {error && rooms.length > 0 && <Alert>{error}</Alert>}

      {initialLoading ? (
        <div className={styles.empty}>
          <Spinner />
        </div>
      ) : error && rooms.length === 0 ? (
        <div className={styles.empty}>
          <WifiOff size={32} aria-hidden />
          <p>Не удалось загрузить комнаты.</p>
          <p className="text-muted text-sm">{error}</p>
          <Button size="sm" variant="ghost" icon={<RotateCw size={14} />} disabled={loading} onClick={retry}>
            Повторить
          </Button>
        </div>
      ) : rooms.length === 0 ? (
        <div className={styles.empty}>
          <Radiation size={32} aria-hidden />
          {hasFilters ? (
            <>
              <p>Ничего не найдено.</p>
              <Button
                size="sm"
                variant="ghost"
                icon={<X size={14} />}
                onClick={() => onFiltersChange({ q: "", mode: "", freeSlots: false })}
              >
                Сбросить фильтры
              </Button>
            </>
          ) : (
            <>
              <p>Открытых комнат пока нет.</p>
              <p className="text-muted text-sm">Создайте свою — она появится здесь для всех.</p>
            </>
          )}
        </div>
      ) : (
        <ul className={cx(styles.roomList, loading && styles.stale)}>
          {rooms.map((room, i) => (
            <PublicRoomRow key={room.code} index={i} room={room} disabled={disabled} onJoin={onJoin} />
          ))}
        </ul>
      )}

      {rooms.length < total && (
        <p className="text-muted text-sm">
          Показаны {rooms.length} из {total}. Уточните поиск, чтобы найти нужную комнату.
        </p>
      )}
    </Panel>
  );
};

/** Typing is local; the URL (and the request) updates after a pause. */
const SearchInput = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // The URL changed from outside (reset, back button) — follow it.
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== draft.trim()) setDraft(value);
  }

  useEffect(() => {
    if (draft.trim() === value) return;
    const timer = setTimeout(() => onChange(draft.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <div className={styles.search}>
      <Search size={16} className={styles.searchIcon} aria-hidden />
      <Input
        type="search"
        placeholder="Название или хост"
        aria-label="Поиск комнат"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  );
};

const PublicRoomRow = ({
  room,
  index,
  disabled,
  onJoin,
}: {
  room: PublicRoomSummary;
  index: number;
  disabled: boolean;
  onJoin: (code: string) => void;
}) => {
  const isFull = room.players >= room.maxPlayers;

  return (
    <li className={cx(styles.room, "enter")} style={{ "--i": index } as CSSProperties}>
      <div className={styles.roomInfo}>
        <strong className={styles.roomTitle}>{room.title}</strong>
        <div className={styles.roomMeta}>
          {room.mode === "AUTO" ? (
            <Badge icon={<Bot size={12} />}>авто</Badge>
          ) : (
            <Badge tone="accent" icon={<Gavel size={12} />}>
              с ведущим
            </Badge>
          )}
          <span className="text-muted text-sm">хост: {room.hostName}</span>
        </div>
      </div>

      <div className={styles.roomSlots}>
        <span className="mono">
          {room.players}/{room.maxPlayers}
        </span>
        <span className={styles.slotsBar}>
          <span style={{ width: `${Math.min(100, (room.players / room.maxPlayers) * 100)}%` }} />
        </span>
      </div>

      <Button
        size="sm"
        variant={isFull ? "ghost" : "secondary"}
        disabled={disabled || isFull}
        onClick={() => onJoin(room.code)}
      >
        {isFull ? "Мест нет" : "Войти"}
      </Button>
    </li>
  );
};
