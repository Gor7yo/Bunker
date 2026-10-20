import { observer } from "mobx-react-lite";
import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Copy,
  Crown,
  Gavel,
  Globe,
  Hourglass,
  Lock,
  LogOut,
  Play,
  Settings2,
  UserX,
  Users,
  WifiOff,
} from "lucide-react";

import type { PublicPlayer, RoomView } from "../../api/types";
import { SettingsForm } from "../../components/SettingsForm";
import { Alert, Badge, Button, Page, Panel, cx } from "../../components/ui";
import { useAction } from "../../hooks/useAction";
import { roomStore } from "../../store/roomStore";
import { toastStore } from "../../store/toastStore";
import { VideoStrip } from "../../voice/VideoStrip";
import styles from "./Lobby.module.css";

export const Lobby = observer(({ view }: { view: RoomView }) => {
  const navigate = useNavigate();
  const { run, pending, error, setError } = useAction();
  // Settings errors go to toasts: they stay visible over the setup drawer.
  const settingsAction = useAction({ onError: toastStore.error });
  const [copied, setCopied] = useState(false);

  const { me, isHost, connected } = roomStore;
  const { settings } = view;
  const isModerated = settings.mode === "MODERATED";
  const players = view.players.filter((p) => p.role === "PLAYER");
  const moderator = view.players.find((p) => p.role === "MODERATOR");

  const notReady = view.players.filter((p) => !p.isHost && !p.isReady);
  const offline = view.players.filter((p) => !p.isOnline);
  const blockers = [
    isModerated && !moderator && "назначьте ведущего",
    notReady.length > 0 && `не готовы: ${notReady.map((p) => p.name).join(", ")}`,
    offline.length > 0 && `не в сети: ${offline.map((p) => p.name).join(", ")}`,
  ].filter(Boolean) as string[];

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(view.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable on insecure origins — the code is visible anyway.
    }
  };

  const leave = () => {
    if (!confirm("Выйти из комнаты?")) return;
    void run(async () => {
      await roomStore.leave();
      navigate("/");
    });
  };

  return (
    <Page>
      <Panel accent className={styles.header}>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>{settings.title}</h1>
          <div className={styles.meta}>
            <button type="button" className={styles.code} onClick={copyCode} title="Скопировать код комнаты">
              {view.code}
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {settings.isPublic ? (
              <Badge icon={<Globe size={12} />}>публичная</Badge>
            ) : (
              <Badge icon={<Lock size={12} />}>приватная</Badge>
            )}
            <Badge tone={isModerated ? "accent" : "neutral"}>{isModerated ? "с ведущим" : "автоматическая"}</Badge>
            {!connected && <Badge tone="danger">нет связи</Badge>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="danger" size="sm" icon={<LogOut size={14} />} onClick={leave}>
            Выйти
          </Button>
        </div>
      </Panel>

      <VideoStrip players={view.players} canMute={isHost} />

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className={styles.grid}>
        <Panel title={`Игроки ${players.length}/${settings.maxPlayers}`} icon={<Users size={18} />}>
          <ul className={styles.players}>
            {view.players.map((player, i) => (
              <PlayerRow
                key={player.id}
                index={i}
                player={player}
                isMe={player.id === me?.id}
                canManage={isHost && player.id !== me?.id}
                canMakeModerator={isModerated && player.role === "PLAYER"}
                disabled={pending}
                onAction={(action) => void run(action)}
              />
            ))}
          </ul>
        </Panel>

        <Panel
          title="Настройки"
          icon={<Settings2 size={18} />}
          actions={!isHost && <span className="text-muted text-sm">меняет хост</span>}
        >
          <SettingsForm
            value={settings}
            disabled={!isHost || pending}
            onChange={(patch) => void settingsAction.run(() => roomStore.updateSettings(patch))}
          />
        </Panel>
      </div>

      <Panel className={styles.footer}>
        {isHost ? (
          <>
            {blockers.length > 0 && <p className="text-secondary text-sm">Чтобы начать: {blockers.join("; ")}</p>}
            <Button
              variant="primary"
              block
              icon={<Play size={18} />}
              disabled={pending || blockers.length > 0}
              onClick={() => void run(() => roomStore.start())}
            >
              Начать игру
            </Button>
          </>
        ) : (
          <Button
            variant={me?.isReady ? "success" : "primary"}
            block
            icon={me?.isReady ? <Check size={18} /> : <Hourglass size={18} />}
            disabled={pending}
            onClick={() => void run(() => roomStore.setReady(!me?.isReady))}
          >
            {me?.isReady ? "Готов — нажмите, чтобы отменить" : "Я готов"}
          </Button>
        )}
      </Panel>
    </Page>
  );
});

interface PlayerRowProps {
  player: PublicPlayer;
  index: number;
  isMe: boolean;
  canManage: boolean;
  canMakeModerator: boolean;
  disabled: boolean;
  onAction: (action: () => Promise<unknown>) => void;
}

const PlayerRow = ({ player, index, isMe, canManage, canMakeModerator, disabled, onAction }: PlayerRowProps) => (
  <li className={cx(styles.player, "enter", !player.isOnline && styles.offline)} style={{ "--i": index } as CSSProperties}>
    <div className={styles.playerName}>
      {player.isHost && <Crown size={16} className={styles.hostIcon} aria-label="Хост" />}
      <span className={styles.name}>{player.name}</span>
      {isMe && <Badge>вы</Badge>}
      {player.role === "MODERATOR" && (
        <Badge tone="accent" icon={<Gavel size={12} />}>
          ведущий
        </Badge>
      )}
      {!player.isOnline && <WifiOff size={14} aria-label="Не в сети" className="text-muted" />}
    </div>

    <div className={styles.playerActions}>
      {!player.isHost && <Badge tone={player.isReady ? "success" : "neutral"}>{player.isReady ? "готов" : "ждём"}</Badge>}
      {canManage && (
        <>
          {canMakeModerator && (
            <Button
              size="sm"
              variant="ghost"
              title="Сделать ведущим"
              aria-label={`Сделать ${player.name} ведущим`}
              disabled={disabled}
              icon={<Gavel size={14} />}
              onClick={() => onAction(() => roomStore.setModerator(player.id))}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            title="Передать права хоста"
            aria-label={`Передать права хоста ${player.name}`}
            disabled={disabled}
            icon={<Crown size={14} />}
            onClick={() =>
              confirm(`Передать права хоста игроку ${player.name}?`) &&
              onAction(() => roomStore.transferHost(player.id))
            }
          />
          <Button
            size="sm"
            variant="danger"
            title="Выгнать"
            aria-label={`Выгнать ${player.name}`}
            disabled={disabled}
            icon={<UserX size={14} />}
            onClick={() => confirm(`Выгнать ${player.name}?`) && onAction(() => roomStore.kick(player.id))}
          />
        </>
      )}
    </div>
  </li>
);
