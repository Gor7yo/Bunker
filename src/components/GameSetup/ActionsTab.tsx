import { actionAvailable } from "../../api/settings";
import { CARD_LABELS, activeKeys, type Catalog, type RoomSettings, type SettingsPatch } from "../../api/types";
import { Alert, Button, Switch, cx } from "../ui";
import styles from "./GameSetup.module.css";

interface TabProps {
  value: RoomSettings;
  catalog: Catalog;
  onChange: (patch: SettingsPatch) => void;
  disabled?: boolean;
}

/** Which action cards are in the deck. */
export const ActionsTab = ({ value, catalog, onChange, disabled }: TabProps) => {
  const { disabledActions } = value.cards;
  const active = activeKeys(value);
  const cards = catalog.cards.action;

  if (!active.includes("action")) {
    return <Alert tone="info">Характеристика «Действие» выключена — карт действий в игре не будет.</Alert>;
  }

  const setDisabled = (list: string[]) => onChange({ cards: { disabledActions: list } });

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <p className={styles.note}>
          В колоде {cards.filter((card) => actionAvailable(value, catalog, card.value)).length} из {cards.length}.
          Карта, которой не хватает характеристик, не раздаётся.
        </p>
        {disabledActions.length > 0 && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setDisabled([])}>
            Включить все
          </Button>
        )}
      </div>

      {cards.map((card) => {
        const needs = catalog.actionNeeds[card.value];
        const missing = needs && !needs.some((key) => active.includes(key));
        const enabled = !disabledActions.includes(card.value);
        const needText = needs?.map((key) => `«${CARD_LABELS[key]}»`).join(needs.length > 1 ? " или " : "");

        return (
          <div key={card.value} className={cx(styles.action, (missing || !enabled) && styles.off)}>
            <Switch
              label={card.value}
              hint={missing ? `Нужна характеристика ${needText} — сейчас она выключена` : card.description}
              checked={enabled && !missing}
              disabled={disabled || missing}
              onChange={(on) =>
                setDisabled(on ? disabledActions.filter((v) => v !== card.value) : [...disabledActions, card.value])
              }
            />
          </div>
        );
      })}
    </div>
  );
};
