import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircleHelp,
  DoorOpen,
  Gavel,
  IdCard,
  LogOut,
  Radiation,
  ScrollText,
  ShieldCheck,
  Trophy,
  Undo2,
  User,
} from "lucide-react";

import type { GameView, RoomView } from "../../api/types";
import { Badge, Button, Drawer, cx } from "../../components/ui";
import { useAction } from "../../hooks/useAction";
import { useFitGrid } from "../../hooks/useFitGrid";
import { roomStore } from "../../store/roomStore";
import { sfx } from "../../sound/sfx";
import { useGameSounds } from "../../sound/useGameSounds";
import { count } from "../../utils/plural";
import { toastStore } from "../../store/toastStore";
import { canRevealNow, GameActionsContext, type GameActions, type GameEvent, type SidePanel } from "./gameActions";
import { GameLog } from "./GameLog";
import { HelpContent } from "./HelpContent";
import { ModeratorPanel } from "./ModeratorPanel";
import { MyCard } from "./MyCard";
import { PhaseBanner } from "./PhaseBanner";
import { PlayerManage } from "./PlayerManage";
import { PlayerTile } from "./PlayerTile";
import { BunkerDoor } from "./OutcomeScenes";
import { RoundSplash } from "./RoundSplash";
import { ScenarioContent } from "./ScenarioPanel";
import styles from "./GameScreen.module.css";

const GRID_GAP = 12;
const SPLASH_MS = 3000;
const HELP_SEEN_KEY = "bunker.helpSeen";

const readHelpSeen = () => {
  try {
    return localStorage.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return true;
  }
};

export const GameScreen = observer(({ view }: { view: RoomView }) => {
  const navigate = useNavigate();
  const { run, pending } = useAction({ onError: toastStore.error });
  const { isHost, isModerator, isAlivePlayer } = roomStore;
  const game = view.game;

  const [modSeconds, setModSeconds] = useState<number | null>(60);
  const [side, setSide] = useState<SidePanel>(null);
  const [scenarioOpen, setScenarioOpen] = useState(game?.phase === "INTRO");
  const [finalOpen, setFinalOpen] = useState(true);
  const [helpSeen, setHelpSeen] = useState(readHelpSeen);

  const openHelp = () => {
    setSide({ kind: "help" });
    setHelpSeen(true);
    try {
      localStorage.setItem(HELP_SEEN_KEY, "1");
    } catch {
      // ignore
    }
  };

  // "My card" slides down by itself when it's my turn to reveal and hides after.
  const canReveal = game ? canRevealNow(view, game, isAlivePlayer) : false;
  const [cardOpen, setCardOpen] = useState(canReveal);
  const [prevCanReveal, setPrevCanReveal] = useState(canReveal);
  if (canReveal !== prevCanReveal) {
    setPrevCanReveal(canReveal);
    setCardOpen(canReveal);
    if (canReveal) setScenarioOpen(false);
  }

  useGameSounds(view, game);

  // "РАУНД N" slams onto the screen when a new round starts.
  const round = game?.round ?? 0;
  const [prevRound, setPrevRound] = useState(round);
  const [splashRound, setSplashRound] = useState<number | null>(null);
  if (round !== prevRound) {
    setPrevRound(round);
    if (round > prevRound) setSplashRound(round);
  }
  useEffect(() => {
    if (splashRound === null) return;
    const timer = setTimeout(() => setSplashRound(null), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [splashRound]);

  // End of the game: the whole UI turns red or green for this player.
  const me = view.players.find((p) => p.id === view.meId);
  const outcome: Outcome =
    game?.phase !== "FINISHED" || !me || me.role === "MODERATOR"
      ? null
      : me.isAlive && !me.hasLeft
        ? "won"
        : "lost";
  useOutcomeTheme(outcome);

  // Game over: drawers with live controls make no sense anymore.
  const isFinished = game?.phase === "FINISHED";
  const [prevFinished, setPrevFinished] = useState(isFinished);
  if (isFinished !== prevFinished) {
    setPrevFinished(isFinished);
    if (isFinished) {
      setSide(null);
      setCardOpen(false);
      setScenarioOpen(false);
      setFinalOpen(true);
    }
  }

  // Moderator: a new card waiting for approval opens the console.
  const pendingCount = game?.pendingActions.length ?? 0;
  const [prevPending, setPrevPending] = useState(pendingCount);
  if (pendingCount !== prevPending) {
    setPrevPending(pendingCount);
    if (isModerator && pendingCount > prevPending) setSide({ kind: "console" });
  }

  // Everyone on camera: the moderator first, then card holders.
  const tiles = view.players.filter((p) => (p.role === "MODERATOR" ? !p.hasLeft : true));
  tiles.sort((a, b) => Number(b.role === "MODERATOR") - Number(a.role === "MODERATOR"));
  const grid = useFitGrid<HTMLDivElement>(tiles.length, { gap: GRID_GAP, minWidth: 260 });

  if (!game) return null;

  const actions: GameActions = {
    act: (event: GameEvent, payload?: object) => void run(() => roomStore.gameAction(event, payload)),
    pending,
    modSeconds,
    openSide: setSide,
  };

  const leave = () => {
    if (!confirm("Покинуть игру? Вернуться в неё будет нельзя.")) return;
    void run(async () => {
      await roomStore.leave();
      navigate("/");
    });
  };

  const backToLobby = () => {
    if (game.phase !== "FINISHED" && !confirm("Прервать игру и вернуть всех в лобби?")) return;
    actions.act("game:backToLobby");
  };

  const finished = game.phase === "FINISHED";
  const managed = side?.kind === "player" ? view.players.find((p) => p.id === side.playerId) : undefined;

  return (
    <GameActionsContext.Provider value={actions}>
      <div className={styles.screen}>
        <header className={styles.topbar}>
          <div className={styles.topInfo}>
            <h1 className={styles.title}>{view.settings.title}</h1>
            <Badge icon={<User size={12} />}>
              {game.aliveCount} в игре · {count(game.seats, ["место", "места", "мест"])}
            </Badge>
          </div>

          <nav className={styles.topActions} aria-label="Игра">
            {view.myCard && (
              <Button
                size="sm"
                variant={canReveal ? "primary" : "secondary"}
                className={cx(canReveal && styles.pulse)}
                icon={<IdCard size={16} />}
                aria-expanded={cardOpen}
                onClick={() => {
                  setCardOpen((v) => !v);
                  setScenarioOpen(false);
                }}
              >
                <span className={styles.label}>Моя карта</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={<Radiation size={16} />}
              onClick={() => {
                setScenarioOpen(true);
                setCardOpen(false);
              }}
            >
              <span className={styles.label}>Сценарий</span>
            </Button>
            <Button size="sm" variant="ghost" icon={<ScrollText size={16} />} onClick={() => setSide({ kind: "log" })}>
              <span className={styles.label}>Журнал</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cx(!helpSeen && styles.attention)}
              icon={<CircleHelp size={16} />}
              onClick={openHelp}
              aria-label="Как играть"
              title="Как играть"
            />
            {isModerator && !finished && (
              <Button size="sm" variant="secondary" icon={<Gavel size={16} />} onClick={() => setSide({ kind: "console" })}>
                <span className={styles.label}>Пульт</span>
                {pendingCount > 0 && <span className={styles.countBadge}>{pendingCount}</span>}
              </Button>
            )}
            {finished && !finalOpen && (
              <Button size="sm" variant="secondary" icon={<Trophy size={16} />} onClick={() => setFinalOpen(true)}>
                <span className={styles.label}>Итоги</span>
              </Button>
            )}

            <span className={styles.divider} aria-hidden />
            {isHost && (
              <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={backToLobby}>
                <span className={styles.label}>{finished ? "В лобби" : "Прервать"}</span>
              </Button>
            )}
            <Button size="sm" variant="danger" icon={<LogOut size={14} />} onClick={leave} aria-label="Выйти">
              <span className={styles.label}>Выйти</span>
            </Button>
          </nav>
        </header>

        {!finished && <PhaseBanner view={view} game={game} />}

        <main ref={grid.ref} className={styles.stage} aria-label="Игроки">
          {grid.ready && (
            <div className={styles.grid} style={{ gap: GRID_GAP }}>
              {tiles.map((player, i) => (
                <PlayerTile key={player.id} player={player} view={view} game={game} width={grid.tileWidth} index={i} />
              ))}
            </div>
          )}
        </main>
      </div>

      <Drawer side="top" open={cardOpen} onClose={() => setCardOpen(false)} title="Моя карта" icon={<IdCard size={18} />}>
        <MyCard view={view} game={game} />
      </Drawer>

      <Drawer
        side="top"
        open={scenarioOpen}
        onClose={() => setScenarioOpen(false)}
        title="Сценарий"
        icon={<Radiation size={18} />}
      >
        <ScenarioContent game={game} />
      </Drawer>

      <Drawer
        side="right"
        open={side !== null}
        onClose={() => setSide(null)}
        title={
          side?.kind === "console"
            ? "Пульт ведущего"
            : side?.kind === "log"
              ? "Журнал"
              : side?.kind === "help"
                ? "Как играть"
                : (managed?.name ?? "Игрок")
        }
        icon={
          side?.kind === "console" ? (
            <Gavel size={18} />
          ) : side?.kind === "log" ? (
            <ScrollText size={18} />
          ) : side?.kind === "help" ? (
            <CircleHelp size={18} />
          ) : (
            <User size={18} />
          )
        }
      >
        {side?.kind === "console" && (
          <ModeratorPanel view={view} game={game} seconds={modSeconds} onSecondsChange={setModSeconds} />
        )}
        {side?.kind === "player" && <PlayerManage view={view} game={game} playerId={side.playerId} />}
        {side?.kind === "log" && <GameLog entries={game.log} />}
        {side?.kind === "help" && <HelpContent view={view} game={game} />}
      </Drawer>

      {splashRound !== null && (
        <RoundSplash
          key={splashRound}
          round={splashRound}
          subtitle={
            game.aliveCount - game.seats <= 1
              ? "Последний раунд"
              : `Изгнать ещё: ${game.aliveCount - game.seats}`
          }
        />
      )}

      {finished && finalOpen && (
        <FinalOverlay
          view={view}
          game={game}
          outcome={outcome}
          onClose={() => setFinalOpen(false)}
          onBackToLobby={isHost ? backToLobby : undefined}
        />
      )}
    </GameActionsContext.Provider>
  );
});

type Outcome = "won" | "lost" | null;

/** Sets <html data-outcome> (colour theme) and plays the outcome sound once. */
function useOutcomeTheme(outcome: Outcome) {
  const played = useRef(outcome !== null); // reload of a finished game: stay quiet
  useEffect(() => {
    const root = document.documentElement;
    if (!outcome) {
      delete root.dataset.outcome;
      played.current = false;
      return;
    }
    root.dataset.outcome = outcome;
    if (!played.current) {
      played.current = true;
      sfx.play(outcome === "won" ? "bunkerOpen" : "bunkerClose");
    }
    return () => {
      delete root.dataset.outcome;
    };
  }, [outcome]);
}

interface FinalOverlayProps {
  view: RoomView;
  game: GameView;
  outcome: Outcome;
  onClose: () => void;
  onBackToLobby?: () => void;
}

const FinalOverlay = ({ view, game, outcome, onClose, onBackToLobby }: FinalOverlayProps) => {
  const participants = view.players.filter((p) => p.role === "PLAYER");
  const survivors = participants.filter((p) => p.isAlive && !p.hasLeft);
  const outside = participants.filter((p) => !p.isAlive || p.hasLeft);
  const iSurvived = survivors.some((p) => p.id === view.meId);

  return (
    <div
      className={cx(styles.finalBackdrop, outcome && styles[`final_${outcome}`])}
      role="dialog"
      aria-modal="true"
      aria-labelledby="final-title"
    >
      <section className={styles.final}>
        {outcome ? (
          <BunkerDoor mode={outcome === "won" ? "open" : "close"} />
        ) : (
          <ShieldCheck size={44} className={styles.finalIcon} aria-hidden />
        )}
        <h2 id="final-title" className={styles.finalTitle}>
          {roomStore.isModerator ? "Игра окончена" : iSurvived ? "Вы в бункере!" : "Вы остались снаружи"}
        </h2>
        <p className="text-secondary">
          {game.catastrophe.title}. Выжившим предстоит провести в бункере {game.catastrophe.stay}.
        </p>
        <div className={styles.finalLists}>
          <div>
            <h3>В бункере</h3>
            <p>{survivors.map((p) => p.name).join(", ") || "никого"}</p>
          </div>
          <div>
            <h3>Снаружи</h3>
            <p className="text-secondary">{outside.map((p) => p.name).join(", ") || "никого"}</p>
          </div>
        </div>
        <div className={styles.finalActions}>
          <Button variant="secondary" onClick={onClose}>
            Посмотреть все карты
          </Button>
          {onBackToLobby ? (
            <Button variant="primary" icon={<DoorOpen size={18} />} onClick={onBackToLobby}>
              Новая игра
            </Button>
          ) : (
            <span className="text-muted text-sm">Хост может начать новую игру</span>
          )}
        </div>
      </section>
    </div>
  );
};
