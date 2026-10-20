import { observer } from "mobx-react-lite";
import { useState } from "react";
import { ArrowLeftRight, Flag, Play, Square, Vote } from "lucide-react";

import { CARD_LABELS, activeKeys, type CardKey, type GamePhase, type GameView, type RoomView } from "../../api/types";
import { Button, Field, Select, cx } from "../../components/ui";
import { PHASE_LABELS, useGameActions } from "./gameActions";
import styles from "./GameScreen.module.css";

const TIMER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Без таймера" },
  { value: 30, label: "30 сек" },
  { value: 60, label: "1 мин" },
  { value: 120, label: "2 мин" },
  { value: 180, label: "3 мин" },
  { value: 300, label: "5 мин" },
];

const MANUAL_PHASES: GamePhase[] = ["INTRO", "REVEAL", "DISCUSSION"];

interface Props {
  view: RoomView;
  game: GameView;
  seconds: number | null;
  onSecondsChange: (seconds: number | null) => void;
}

/** Contents of the moderator console drawer. */
export const ModeratorPanel = observer(({ view, game, seconds, onSecondsChange }: Props) => {
  const { act, pending } = useGameActions();
  const alive = view.players.filter((p) => p.role === "PLAYER" && p.isAlive && !p.hasLeft);
  const leaders = (game.lastVote?.leaders ?? []).filter((id) => alive.some((p) => p.id === id));
  const enoughExiled = game.aliveCount <= game.seats;

  return (
    <div className={styles.console}>
      {game.pendingActions.length > 0 && <PendingActions view={view} game={game} />}

      <div className={styles.modRow}>
        <Field label="Таймер для фаз и слова" className={styles.modTimer}>
          <Select
            value={seconds ?? ""}
            onChange={(e) => onSecondsChange(e.target.value === "" ? null : Number(e.target.value))}
          >
            {TIMER_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ""}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="primary" icon={<Play size={16} />} disabled={pending} onClick={() => act("mod:nextRound")}>
          {game.round === 0 ? "Начать первый раунд" : `Начать раунд ${game.round + 1}`}
        </Button>
      </div>

      {game.round > 0 && (
        <div className={styles.modRow}>
          <span className={styles.modLabel}>Фаза</span>
          <div className={styles.modButtons}>
            {MANUAL_PHASES.map((phase) => (
              <Button
                key={phase}
                size="sm"
                variant={game.phase === phase ? "secondary" : "ghost"}
                className={cx(game.phase === phase && styles.modActive)}
                disabled={pending}
                onClick={() => act("mod:phase", { phase, seconds })}
              >
                {PHASE_LABELS[phase]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {game.round > 0 && (
        <div className={styles.modRow}>
          <span className={styles.modLabel}>Голосование</span>
          <div className={styles.modButtons}>
            {game.phase === "VOTING" ? (
              <Button size="sm" variant="primary" icon={<Square size={14} />} disabled={pending} onClick={() => act("mod:closeVoting")}>
                Закрыть ({game.votedIds.length}/{game.aliveCount})
              </Button>
            ) : (
              <>
                <Button size="sm" icon={<Vote size={14} />} disabled={pending} onClick={() => act("mod:startVoting", { seconds })}>
                  Начать
                </Button>
                {leaders.length > 1 && leaders.length < alive.length && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => act("mod:startVoting", { candidates: leaders, seconds })}
                  >
                    Переголосовать между лидерами
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <SwapForm view={view} />

      <div className={styles.modFooter}>
        <span className="text-sm text-secondary">
          В игре {game.aliveCount}, мест {game.seats}
          {enoughExiled ? " — можно завершать" : ` — изгнать ещё ${game.aliveCount - game.seats}`}
        </span>
        <Button
          size="sm"
          variant={enoughExiled ? "primary" : "ghost"}
          icon={<Flag size={14} />}
          disabled={pending}
          onClick={() => confirm("Завершить игру и открыть все карты?") && act("mod:finish")}
        >
          Завершить игру
        </Button>
      </div>
    </div>
  );
});

/** Action cards waiting for the moderator's decision. */
const PendingActions = ({ view, game }: { view: RoomView; game: GameView }) => {
  const { act, pending } = useGameActions();
  const nameOf = (id?: string) => view.players.find((p) => p.id === id)?.name;

  return (
    <div className={styles.modRow}>
      <span className={styles.modLabel}>Карты на одобрении</span>
      <ul className={styles.pendingList}>
        {game.pendingActions.map((a) => {
          const targets = [nameOf(a.params.targetId), nameOf(a.params.otherId)].filter(Boolean).join(" и ");
          return (
            <li key={a.id} className={styles.pendingItem}>
              <span>
                <strong>{nameOf(a.playerId)}</strong> играет «{a.value}»
                {targets && <> → {targets}</>}
                {a.params.key && <> ({CARD_LABELS[a.params.key].toLowerCase()})</>}
              </span>
              {a.description && <span className="text-secondary">{a.description}</span>}
              <div className={styles.pendingButtons}>
                <Button size="sm" variant="success" disabled={pending} onClick={() => act("mod:approveAction", { id: a.id })}>
                  Одобрить
                </Button>
                <Button size="sm" variant="danger" disabled={pending} onClick={() => act("mod:rejectAction", { id: a.id })}>
                  Отклонить
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SwapForm = ({ view }: { view: RoomView }) => {
  const { act, pending } = useGameActions();
  const holders = view.players.filter((p) => p.role === "PLAYER" && p.card && !p.hasLeft);
  const keys = activeKeys(view.settings);
  const [key, setKey] = useState<CardKey>(keys.includes("profession") ? "profession" : keys[0]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  return (
    <div className={styles.modRow}>
      <span className={styles.modLabel}>Обмен</span>
      <div className={styles.swap}>
        <Select aria-label="Характеристика" value={key} onChange={(e) => setKey(e.target.value as CardKey)}>
          {keys.map((k) => (
            <option key={k} value={k}>
              {CARD_LABELS[k]}
            </option>
          ))}
        </Select>
        <Select aria-label="Первый игрок" value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Игрок 1</option>
          {holders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Второй игрок" value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Игрок 2</option>
          {holders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          icon={<ArrowLeftRight size={14} />}
          disabled={pending || !a || !b || a === b}
          onClick={() => act("mod:swap", { playerId: a, otherId: b, key })}
        >
          Поменять
        </Button>
      </div>
    </div>
  );
};
