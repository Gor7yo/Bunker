import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { CARD_KEYS, CARD_LABELS, type CardKey, type PlayerCard } from "../api/types";
import { TRAIT_ICONS, traitColor } from "./traits";
import { cx, useTooltip } from "./ui";
import styles from "./CardView.module.css";

interface CardViewProps {
  /** Characteristics in play, in order. */
  keys?: readonly CardKey[];
  /** Known values: own card, moderator's view, or only revealed ones. */
  card: Partial<PlayerCard>;
  /** Keys revealed to everyone. */
  revealed?: CardKey[];
  /** Show unknown rows as "???" instead of skipping them. */
  showHidden?: boolean;
  /** Extra controls at the end of a row (reveal button, moderator tools). */
  action?: (key: CardKey) => ReactNode;
  /** Highlight a row (e.g. the characteristic that must be revealed). */
  highlight?: CardKey | null;
  compact?: boolean;
  /** Card value → description; shown in a tooltip on the value. */
  hints?: Record<string, string>;
}

/**
 * Characteristics list. A row is "revealed" (everyone sees it), "secret"
 * (known to the viewer only) or unknown ("???").
 */
export const CardView = ({
  keys = CARD_KEYS,
  card,
  revealed = [],
  showHidden = false,
  action,
  highlight,
  compact,
  hints = {},
}: CardViewProps) => (
  <ul className={cx(styles.card, compact && styles.compact)}>
    {keys.map((key) => {
      const value = card[key];
      const isRevealed = revealed.includes(key);
      if (!value && !showHidden) return null;
      const Icon = TRAIT_ICONS[key];

      return (
        <li
          key={key}
          className={cx(
            styles.row,
            isRevealed ? styles.revealed : value ? styles.secret : styles.unknown,
            highlight === key && styles.highlight,
          )}
        >
          <span className={styles.label}>
            <Icon size={14} style={{ color: traitColor(key) }} />
            {CARD_LABELS[key]}
          </span>
          <Value value={value} hint={value ? hints[value] : undefined} />
          {action && <span className={styles.action}>{action(key)}</span>}
        </li>
      );
    })}
  </ul>
);

/** Value text; with a description it gets an "i" and a tooltip. */
const Value = ({ value, hint }: { value: string | undefined; hint: string | undefined }) => {
  const { anchorProps, tooltip } = useTooltip<HTMLSpanElement>(hint);
  return (
    <span {...anchorProps} className={cx(styles.value, hint && styles.hoverable)}>
      {value ?? "???"}
      {hint && <Info size={12} className={styles.info} aria-label="Есть описание" />}
      {tooltip}
    </span>
  );
};
