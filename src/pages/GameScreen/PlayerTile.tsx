import { observer } from "mobx-react-lite";
import type { CSSProperties } from "react";
import { Check, Crown, Gavel, Mic, MicOff, MoreVertical, Shield, Vote } from "lucide-react";

import { activeKeys, type CardKey, type GameView, type PublicPlayer, type RoomView } from "../../api/types";
import { cx } from "../../components/ui";
import { roomStore } from "../../store/roomStore";
import { MicIndicator, ParticipantMedia } from "../../voice/ParticipantMedia";
import { useGameActions } from "./gameActions";
import { TraitChips } from "./TraitChips";
import styles from "./PlayerTile.module.css";

/** Bottom-left column — the main characteristics; the rest go bottom-right. */
const MAIN_TRAITS: CardKey[] = ["gender", "age", "profession", "health"];
const OTHER_TRAITS: CardKey[] = ["phobia", "hobby", "baggage", "fact", "action"];

/** Phases where the last vote count is shown on tiles. */
const SHOW_TALLY = new Set(["VOTE_RESULT", "DEFENSE", "EXILE"]);

interface Props {
  player: PublicPlayer;
  view: RoomView;
  game: GameView;
  width: number;
  /** Position in the grid — staggers the entrance animation. */
  index: number;
}

/** A player's camera with their characteristics and game state on top. */
export const PlayerTile = observer(({ player, view, game, width, index }: Props) => {
  const { act, pending, openSide } = useGameActions();
  const { isModerator, isAlivePlayer } = roomStore;

  const isMe = player.id === view.meId;
  const isModeratorTile = player.role === "MODERATOR";
  const inGame = player.isAlive && !player.hasLeft;
  const isSpeaker = game.speakerId === player.id;
  const finished = game.phase === "FINISHED";
  const inPlay = (key: CardKey) => activeKeys(view.settings).includes(key);

  const canVote =
    game.phase === "VOTING" && isAlivePlayer && !isMe && inGame && game.candidates.includes(player.id);
  const myVote = game.myVote === player.id;
  const hasVoted = game.phase === "VOTING" && game.votedIds.includes(player.id);
  const isReady = game.phase === "DISCUSSION" && game.readyToVote.includes(player.id);

  const liveVotes = game.liveVotes ? Object.values(game.liveVotes).filter((id) => id === player.id).length : 0;
  const tally = SHOW_TALLY.has(game.phase) ? (game.lastVote?.tally[player.id] ?? 0) : 0;
  const votesAgainst = liveVotes || tally;

  // Moderator and the final screen get full cards; others see revealed values only.
  const card = player.card ?? { ...player.known, ...player.revealed };
  const revealedKeys = Object.keys(player.revealed) as CardKey[];
  const showTraits = !isMe && !isModeratorTile;
  const canManage = isModerator && !isModeratorTile && !finished && !!player.card;

  return (
    <article
      className={cx(
        styles.tile,
        isSpeaker && styles.speaker,
        myVote && styles.voted,
        !inGame && !isModeratorTile && styles.out,
      )}
      style={{ width, "--i": index } as CSSProperties}
    >
      <div className={styles.media}>
        <ParticipantMedia playerId={player.id} name={player.name} />
      </div>

      {!inGame && !isModeratorTile && (
        <span className={styles.stamp}>{player.hasLeft ? "Вышел" : "Изгнан"}</span>
      )}

      <div className={styles.top}>
        <div className={styles.identity}>
          <div className={styles.nameBar}>
            {player.isHost && <Crown size={14} className={styles.crown} aria-label="Хост" />}
            {isModeratorTile && <Gavel size={14} className={styles.crown} aria-label="Ведущий" />}
            <span className={styles.name}>{player.name}</span>
            {isMe && <span className={styles.me}>вы</span>}
            {isModeratorTile && <span className={styles.me}>ведущий</span>}
            <MicIndicator playerId={player.id} canMute={isModerator && !isMe} />
          </div>
          <div className={styles.badges}>
            {isSpeaker && (
              <span className={cx(styles.badge, styles.badgeAccent)}>
                <Mic size={12} /> говорит
              </span>
            )}
            {hasVoted && (
              <span className={cx(styles.badge, styles.badgeSuccess)}>
                <Check size={12} /> голос
              </span>
            )}
            {isReady && <span className={cx(styles.badge, styles.badgeSuccess)}>готов</span>}
            {game.silenced.includes(player.id) && (
              <span className={cx(styles.badge, styles.badgeDanger)}>
                <MicOff size={12} /> молчит
              </span>
            )}
            {game.immune.includes(player.id) && (
              <span className={cx(styles.badge, styles.badgeInfo)}>
                <Shield size={12} /> иммунитет
              </span>
            )}
            {votesAgainst > 0 && (
              <span className={cx(styles.badge, styles.badgeDanger)}>
                <Vote size={12} /> {votesAgainst}
              </span>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          {canVote && (
            <button
              type="button"
              className={cx(styles.voteButton, myVote && styles.voteButtonActive)}
              disabled={pending}
              onClick={() => act("game:vote", { playerId: player.id })}
            >
              <Vote size={14} />
              {myVote ? "Ваш голос" : "Голосовать"}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              className={styles.menuButton}
              aria-label={`Управление: ${player.name}`}
              title="Управление игроком"
              onClick={() => openSide({ kind: "player", playerId: player.id })}
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>
      </div>

      {showTraits && (
        <div className={styles.bottom}>
          <TraitChips keys={MAIN_TRAITS.filter(inPlay)} card={card} revealed={revealedKeys} hints={view.hints} />
          <TraitChips keys={OTHER_TRAITS.filter(inPlay)} card={card} revealed={revealedKeys} hints={view.hints} align="end" />
        </div>
      )}
    </article>
  );
});
