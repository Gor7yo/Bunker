import { RotateCw, TriangleAlert } from "lucide-react";

import { Button, Page, Panel } from "./ui";
import styles from "./CrashScreen.module.css";

/** Shown instead of a blank page when rendering crashes. */
export const CrashScreen = () => (
  <Page centered>
    <Panel accent className={styles.panel}>
      <TriangleAlert size={40} className={styles.icon} aria-hidden />
      <h1 className={styles.title}>Что-то сломалось</h1>
      <p className="text-secondary">
        Перезагрузите страницу — если вы были в комнате, вы вернётесь на своё место.
      </p>
      <Button variant="primary" icon={<RotateCw size={16} />} onClick={() => location.reload()}>
        Перезагрузить
      </Button>
    </Panel>
  </Page>
);
