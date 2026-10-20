import { observer } from "mobx-react-lite";
import { useState } from "react";
import { Hourglass, Zap } from "lucide-react";

import { CARD_LABELS, activeKeys, type CardKey, type MyAction, type PublicPlayer, type RoomView } from "../../api/types";
import { Button, Field, Select } from "../../components/ui";
import { useGameActions } from "./gameActions";
import styles from "./GameScreen.module.css";

/** Cards whose target must still have something hidden. */
const NEEDS_HIDDEN = new Set(["Подозрение", "Исповедь"]);
/** Cards that look at a hidden characteristic. */
const PEEK = new Set(["Проверка досье", "Тайное знание"]);


/** The viewer's action card: what it does, targets, "play" button. */
export const ActionCard = observer(({ view, action }: { view: RoomView; action: MyAction }) => {
  const { act, pending } = useGameActions();
  const [targetId, setTargetId] = useState("");
  const [otherId, setOtherId] = useState("");
  const [key, setKey] = useState<CardKey | "">("");
  const hiddenKeysOf = (p: PublicPlayer) => activeKeys(view.settings).filter((k) => !(k in p.revealed));

  const inGame = view.players.filter((p) => p.role === "PLAYER" && p.isAlive && !p.hasLeft);
  const exiled = view.players.filter((p) => p.role === "PLAYER" && !p.isAlive && !p.hasLeft);

  const candidates = (action.target === "exiled" ? exiled : inGame)
    .filter((p) => action.allowSelf || action.target === "twoPlayers" || p.id !== view.meId)
    .filter((p) => !NEEDS_HIDDEN.has(action.value) || hiddenKeysOf(p).length > 0);

  const target = view.players.find((p) => p.id === targetId);
  const keys = action.keys.filter((k) => !PEEK.has(action.value) || !target || hiddenKeysOf(target).includes(k));

  const ready =
    action.target === "none" ||
    (action.target === "twoPlayers" ? targetId && otherId && targetId !== otherId : targetId) &&
      (action.target !== "playerKey" || key);

  const play = () =>
    act("game:playAction", {
      targetId: targetId || undefined,
      otherId: otherId || undefined,
      key: key || undefined,
    });

  const status = action.used
    ? "Карта сыграна"
    : action.pending
      ? "Ждёт одобрения ведущего"
      : action.blockedReason;

  return (
    <section className={styles.actionCard}>
      <header className={styles.actionHeader}>
        <Zap size={16} />
        <strong>{action.value}</strong>
      </header>
      {action.description && <p className="text-sm text-secondary">{action.description}</p>}

      {!action.used && !action.pending && (
        <div className={styles.actionForm}>
          {action.target !== "none" && (
            <Field label={action.target === "twoPlayers" ? "Первый игрок" : "Игрок"}>
              <Select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setKey("");
                }}
              >
                <option value="">— выберите —</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === view.meId ? `${p.name} (вы)` : p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {action.target === "twoPlayers" && (
            <Field label="Второй игрок">
              <Select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
                <option value="">— выберите —</option>
                {candidates
                  .filter((p) => p.id !== targetId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === view.meId ? `${p.name} (вы)` : p.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          {action.target === "playerKey" && (
            <Field label="Характеристика">
              <Select value={key} disabled={!targetId} onChange={(e) => setKey(e.target.value as CardKey)}>
                <option value="">— выберите —</option>
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {CARD_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

      {status ? (
        <p className={styles.actionStatus}>
          {action.pending && <Hourglass size={14} />} {status}
        </p>
      ) : (
        <Button variant="primary" icon={<Zap size={16} />} disabled={pending || !ready} onClick={play}>
          Сыграть карту
        </Button>
      )}
    </section>
  );
});
