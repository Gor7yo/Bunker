import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { roomStore } from "../store/roomStore";
import { Spinner } from "./ui";
import styles from "./ConnectionStatus.module.css";

/** Short blips (page load, quick reconnect) don't deserve a banner. */
const SHOW_AFTER_MS = 1500;

/** A pill at the top of the screen while the server is unreachable. */
export const ConnectionStatus = observer(() => {
  const offline = !roomStore.connected;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!offline) return;
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [offline]);

  if (!offline || !visible) return null;

  return (
    <div className={styles.pill} role="status">
      <WifiOff size={14} aria-hidden />
      Нет связи с сервером — переподключаемся
      <Spinner size={14} />
    </div>
  );
});
