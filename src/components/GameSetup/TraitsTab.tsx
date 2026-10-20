import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  CARD_KEYS,
  CARD_LABELS,
  type CardKey,
  type Catalog,
  type CustomCardKey,
  type CustomDeck,
  type RoomSettings,
  type SettingsPatch,
} from "../../api/types";
import { actionAvailable } from "../../api/settings";
import { TRAIT_ICONS, traitColor } from "../traits";
import { Field, Select, Switch, Textarea, cx } from "../ui";
import { itemsToText, textToItems } from "./deckText";
import styles from "./GameSetup.module.css";

interface TabProps {
  value: RoomSettings;
  catalog: Catalog;
  onChange: (patch: SettingsPatch) => void;
  disabled?: boolean;
}

/** Which characteristics are dealt and what values they take. */
export const TraitsTab = ({ value, catalog, onChange, disabled }: TabProps) => {
  const { cards } = value;
  // Lives here: editors remount on every saved change.
  const [openKey, setOpenKey] = useState<CardKey | null>(null);
  const toggle = (key: CardKey, enabled: boolean) =>
    onChange({
      cards: { disabled: enabled ? cards.disabled.filter((k) => k !== key) : [...cards.disabled, key] },
    });

  return (
    <div className={styles.list}>
      <p className={styles.note}>
        Выключенная характеристика не раздаётся вовсе: её нет на картах, в раскрытии и в картах действий.
      </p>
      {CARD_KEYS.map((key) => {
        const enabled = !cards.disabled.includes(key);
        const Icon = TRAIT_ICONS[key];
        return (
          <section key={key} className={cx(styles.trait, !enabled && styles.off)}>
            <Switch
              label={
                <span className={styles.traitName}>
                  <Icon size={16} style={{ color: traitColor(key) }} />
                  {CARD_LABELS[key]}
                </span>
              }
              hint={enabled ? deckSummary(catalog, key, value) : "не участвует в игре"}
              checked={enabled}
              disabled={disabled}
              onChange={(on) => toggle(key, on)}
            />
            {enabled && key !== "action" && (
              <DeckEditor
                // Remount when the server value changes so the draft resets.
                key={JSON.stringify(cards.custom[key] ?? null)}
                traitKey={key}
                deck={cards.custom[key]}
                builtin={catalog.cards[key]}
                limit={catalog.limits.items}
                open={openKey === key}
                onToggle={() => setOpenKey(openKey === key ? null : key)}
                disabled={disabled}
                onCommit={(deck) => onChange({ cards: { custom: { ...cards.custom, [key]: deck ?? undefined } } })}
              />
            )}
          </section>
        );
      })}
    </div>
  );
};

const deckSummary = (catalog: Catalog, key: CardKey, value: RoomSettings) => {
  if (key === "action") {
    const cards = catalog.cards.action;
    const dealt = cards.filter((card) => actionAvailable(value, catalog, card.value)).length;
    return `карт в колоде: ${dealt} из ${cards.length} — выбираются во вкладке «Действия»`;
  }
  const builtin = catalog.cards[key].length;
  const custom = value.cards.custom[key];
  if (!custom) return `встроенные значения: ${builtin}`;
  return custom.replace
    ? `только свои значения: ${custom.items.length}`
    : `встроенные (${builtin}) + свои (${custom.items.length})`;
};

type Source = "BUILTIN" | "ADD" | "REPLACE";

interface DeckEditorProps {
  traitKey: CustomCardKey;
  deck: CustomDeck | undefined;
  builtin: Catalog["cards"][CardKey];
  limit: number;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** null — back to built-in values only. */
  onCommit: (deck: CustomDeck | null) => void;
}

const DeckEditor = ({ traitKey, deck, builtin, limit, open, onToggle, disabled, onCommit }: DeckEditorProps) => {
  const initialSource: Source = !deck ? "BUILTIN" : deck.replace ? "REPLACE" : "ADD";
  const [source, setSource] = useState<Source>(initialSource);
  const [text, setText] = useState(itemsToText(deck?.items ?? []));
  const count = textToItems(text).length;

  const commit = (nextSource: Source, nextText: string) => {
    if (nextSource === "BUILTIN") return deck && onCommit(null);
    const items = textToItems(nextText);
    // Only own values need at least one; the server would reject it anyway.
    if (nextSource === "REPLACE" && items.length === 0) return;
    if (nextSource === "ADD" && items.length === 0) return deck && onCommit(null);
    onCommit({ replace: nextSource === "REPLACE", items });
  };

  const changeSource = (next: Source) => {
    let nextText = text;
    // Own values only: start from the built-in list so there is something to edit.
    if (next === "REPLACE" && !textToItems(text).length) nextText = itemsToText(builtin);
    setSource(next);
    setText(nextText);
    commit(next, nextText);
  };

  return (
    <div className={styles.deck}>
      <button type="button" className={styles.deckToggle} aria-expanded={open} onClick={onToggle}>
        <ChevronDown size={14} className={cx(styles.chevron, open && styles.chevronOpen)} />
        Значения
      </button>

      {open && (
        <div className={styles.deckBody}>
          <Field label="Откуда берутся значения">
            <Select disabled={disabled} value={source} onChange={(e) => changeSource(e.target.value as Source)}>
              <option value="BUILTIN">Только встроенные</option>
              <option value="ADD">Встроенные + свои</option>
              <option value="REPLACE">Только свои</option>
            </Select>
          </Field>

          {source !== "BUILTIN" && (
            <Field
              label={`Свои значения: ${count} / ${limit}`}
              hint="Одно значение на строку. Описание для подсказки можно дописать после «|»."
            >
              <Textarea
                rows={6}
                disabled={disabled}
                value={text}
                placeholder={`${builtin[0]?.value ?? "Значение"} | описание`}
                aria-label={`Свои значения: ${CARD_LABELS[traitKey]}`}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => commit(source, text)}
              />
              {source === "REPLACE" && count === 0 && (
                <span className={styles.warning}>Добавьте хотя бы одно значение</span>
              )}
            </Field>
          )}

          {source !== "REPLACE" && (
            <details className={styles.builtin}>
              <summary>Встроенные значения ({builtin.length})</summary>
              <ul>
                {builtin.map((item) => (
                  <li key={item.value} title={item.description}>
                    {item.value}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
