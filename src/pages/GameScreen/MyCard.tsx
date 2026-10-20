import { observer } from "mobx-react-lite";
import { Eye } from "lucide-react";

import { CARD_LABELS, activeKeys, type CardKey, type GameView, type RoomView } from "../../api/types";
import { CardView } from "../../components/CardView";
import { roomStore } from "../../store/roomStore";
import { ActionCard } from "./ActionCard";
import { canRevealNow, useGameActions } from "./gameActions";
import styles from "./GameScreen.module.css";

/** Contents of the "My card" drawer; hidden rows get "reveal" during my turn. */
export const MyCard = observer(({ view, game }: { view: RoomView; game: GameView }) => {
  const { act, pending } = useGameActions();
  if (!view.myCard) return null;

  const canReveal = canRevealNow(view, game, roomStore.isAlivePlayer);
  const confessing = game.confession?.targetId === view.meId;
  const requiredKey = confessing ? null : game.requiredKey;

  return (
    <>
      <p className="text-sm text-secondary">
        {confessing
          ? "Исповедь: раскройте любую характеристику на свой выбор."
          : canReveal
          ? requiredKey
            ? "Ваш ход. В первом раунде начните с профессии."
            : "Ваш ход: выберите, что раскрыть остальным."
          : `Открыто ${view.myRevealed.length} из ${activeKeys(view.settings).length}. Цветная полоса — видно всем, курсив — только вам.`}
      </p>
      <CardView
        card={view.myCard}
        revealed={view.myRevealed}
        highlight={canReveal ? requiredKey : null}
        hints={view.hints}
        action={
          canReveal
            ? (key) =>
                view.myRevealed.includes(key) ? null : (
                  <button
                    type="button"
                    className={styles.revealButton}
                    disabled={pending || (requiredKey !== null && requiredKey !== key)}
                    onClick={() => act("game:reveal", { key })}
                  >
                    <Eye size={14} />
                    Раскрыть
                  </button>
                )
            : undefined
        }
      />
      {game.myAction && <ActionCard view={view} action={game.myAction} />}
      <KnownSecrets view={view} />
    </>
  );
});

/** What the viewer learned privately (Проверка досье, Тайное знание). */
const KnownSecrets = ({ view }: { view: RoomView }) => {
  const secrets = view.players.flatMap((p) =>
    Object.entries(p.known ?? {}).map(([key, value]) => ({ name: p.name, key: key as CardKey, value })),
  );
  if (secrets.length === 0) return null;

  return (
    <section className={styles.secrets}>
      <h3>Тайные сведения</h3>
      <ul>
        {secrets.map((s) => (
          <li key={`${s.name}-${s.key}`}>
            {s.name}, {CARD_LABELS[s.key].toLowerCase()}: <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
};
