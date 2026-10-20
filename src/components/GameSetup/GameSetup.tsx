import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Layers, SlidersHorizontal, Zap } from "lucide-react";

import { loadCatalog } from "../../api/settings";
import type { Catalog, RoomSettings, SettingsPatch } from "../../api/types";
import { Alert, Drawer, Spinner, cx } from "../ui";
import { ActionsTab } from "./ActionsTab";
import { ScenarioTab } from "./ScenarioTab";
import { TraitsTab } from "./TraitsTab";
import styles from "./GameSetup.module.css";

type Tab = "traits" | "actions" | "scenario";

const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
  { id: "traits", label: "Характеристики", icon: Layers },
  { id: "actions", label: "Действия", icon: Zap },
  { id: "scenario", label: "Сценарий", icon: BookOpen },
];

/** Loads the built-in cards and scenarios once, on first use. */
const useCatalog = (enabled: boolean) => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || catalog) return;
    let alive = true;
    loadCatalog().then(
      (data) => alive && setCatalog(data),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [enabled, catalog]);

  return { catalog, error };
};

interface GameSetupProps {
  open: boolean;
  onClose: () => void;
  value: RoomSettings;
  onChange: (patch: SettingsPatch) => void;
  disabled?: boolean;
}

/**
 * Full game setup: characteristics and their values, action cards, scenario.
 * Rendered in a portal so its inputs never submit a surrounding form.
 */
export const GameSetup = ({ open, onClose, value, onChange, disabled }: GameSetupProps) => {
  const [tab, setTab] = useState<Tab>("traits");
  const { catalog, error } = useCatalog(open);
  const props = { value, onChange, disabled };

  return createPortal(
    <Drawer open={open} onClose={onClose} side="top" title="Настройка игры" icon={<SlidersHorizontal size={18} />}>
      <div className={styles.tabs} role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cx(styles.tab, tab === id && styles.tabActive)}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {disabled && <p className={styles.note}>Настройки меняет хост — здесь можно только посмотреть.</p>}
      {error && <Alert>{error}</Alert>}
      {!catalog && !error && <Spinner />}

      {catalog && tab === "traits" && <TraitsTab {...props} catalog={catalog} />}
      {catalog && tab === "actions" && <ActionsTab {...props} catalog={catalog} />}
      {catalog && tab === "scenario" && <ScenarioTab {...props} catalog={catalog} />}
    </Drawer>,
    document.body,
  );
};
