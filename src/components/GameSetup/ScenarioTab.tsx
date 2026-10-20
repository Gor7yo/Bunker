import { useState, type ReactNode } from "react";
import { Dices, ListChecks, PenLine, Radiation, Warehouse } from "lucide-react";

import type {
  BunkerText,
  CatastropheText,
  Catalog,
  RoomSettings,
  ScenarioChoice,
  SettingsPatch,
} from "../../api/types";
import { Field, Input, Select, Textarea, cx } from "../ui";
import styles from "./GameSetup.module.css";

interface TabProps {
  value: RoomSettings;
  catalog: Catalog;
  onChange: (patch: SettingsPatch) => void;
  disabled?: boolean;
}

/** Catastrophe and bunker: random, picked from the built-in ones, or written by the host. */
export const ScenarioTab = ({ value, catalog, onChange, disabled }: TabProps) => {
  const { catastrophe, bunker } = value.scenario;
  const L = catalog.limits;

  return (
    <div className={styles.list}>
      <ChoiceEditor
        key={`catastrophe:${JSON.stringify(catastrophe)}`}
        title="Катастрофа"
        icon={<Radiation size={16} />}
        choice={catastrophe}
        presets={catalog.catastrophes}
        disabled={disabled}
        empty={{ title: "", description: "", stay: "" } satisfies CatastropheText}
        fromPreset={({ title, description, stay }) => ({ title, description, stay })}
        missing={(v) => [!v.title.trim() && "название", !v.description.trim() && "описание", !v.stay.trim() && "срок"]}
        preview={(p) => (
          <>
            <p>{p.description}</p>
            <p className={styles.meta}>Сидеть в бункере: {p.stay}</p>
          </>
        )}
        onCommit={(next) => onChange({ scenario: { catastrophe: next } })}
        form={(v, set) => (
          <>
            <Field label="Название">
              <Input maxLength={L.title} value={v.title} placeholder="Например, Ядерная зима" onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Что случилось">
              <Textarea maxLength={L.text} rows={4} value={v.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Сколько сидеть в бункере">
              <Input maxLength={L.short} value={v.stay} placeholder="1 год" onChange={(e) => set({ stay: e.target.value })} />
            </Field>
          </>
        )}
      />

      <ChoiceEditor
        key={`bunker:${JSON.stringify(bunker)}`}
        title="Бункер"
        icon={<Warehouse size={16} />}
        choice={bunker}
        presets={catalog.bunkers}
        disabled={disabled}
        empty={{ title: "", description: "", area: "", supplies: "", features: [] } as BunkerText}
        fromPreset={({ title, description, area, supplies }) => ({ title, description, area, supplies, features: [] })}
        missing={(v) => [
          !v.title.trim() && "название",
          !v.description.trim() && "описание",
          !v.area.trim() && "площадь",
          !v.supplies.trim() && "запасы",
        ]}
        preview={(p) => (
          <>
            <p>{p.description}</p>
            <p className={styles.meta}>
              {p.area} · {p.supplies} · особенности выпадут случайно
            </p>
          </>
        )}
        onCommit={(next) => onChange({ scenario: { bunker: next } })}
        form={(v, set) => (
          <>
            <Field label="Название">
              <Input maxLength={L.title} value={v.title} placeholder="Например, Метро-2" onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Описание">
              <Textarea maxLength={L.text} rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <div className={styles.pair}>
              <Field label="Площадь">
                <Input maxLength={L.short} value={v.area} placeholder="200 м²" onChange={(e) => set({ area: e.target.value })} />
              </Field>
              <Field label="Запасы">
                <Input maxLength={L.short} value={v.supplies} placeholder="Еды на 1 год" onChange={(e) => set({ supplies: e.target.value })} />
              </Field>
            </div>
            <Field label={`Особенности (до ${L.features})`} hint="Одна на строку">
              <FeaturesInput value={v.features} onChange={(features) => set({ features })} limit={L.features} />
            </Field>
          </>
        )}
      />
    </div>
  );
};

/** Keeps blank lines while typing; the list itself has none. */
const FeaturesInput = ({ value, onChange, limit }: { value: string[]; onChange: (v: string[]) => void; limit: number }) => {
  const [text, setText] = useState(value.join("\n"));
  return (
    <Textarea
      rows={3}
      value={text}
      placeholder={"Гидропонная ферма\nРадиостанция"}
      onChange={(e) => {
        const lines = e.target.value.split("\n").slice(0, limit);
        setText(lines.join("\n"));
        onChange(lines.map((line) => line.trim()).filter(Boolean));
      }}
    />
  );
};

type Kind = ScenarioChoice<unknown>["kind"];

const KINDS: { kind: Kind; label: string; icon: typeof Dices }[] = [
  { kind: "RANDOM", label: "Случайно", icon: Dices },
  { kind: "PRESET", label: "Из готовых", icon: ListChecks },
  { kind: "CUSTOM", label: "Свой", icon: PenLine },
];

interface ChoiceEditorProps<T, P extends { id: string; title: string }> {
  title: string;
  icon: ReactNode;
  choice: ScenarioChoice<T>;
  presets: P[];
  disabled?: boolean;
  empty: T;
  fromPreset: (preset: P) => T;
  /** Names of required fields that are still empty. */
  missing: (value: T) => (string | false)[];
  preview: (preset: P) => ReactNode;
  form: (value: T, set: (patch: Partial<T>) => void) => ReactNode;
  onCommit: (choice: ScenarioChoice<T>) => void;
}

/**
 * The kind is local until the choice is valid: "Свой" with empty fields
 * isn't sent to the server. Custom text is saved when the form loses focus.
 */
const ChoiceEditor = <T, P extends { id: string; title: string }>({
  title,
  icon,
  choice,
  presets,
  disabled,
  empty,
  fromPreset,
  missing,
  preview,
  form,
  onCommit,
}: ChoiceEditorProps<T, P>) => {
  const [kind, setKind] = useState<Kind>(choice.kind);
  const [presetId, setPresetId] = useState(choice.kind === "PRESET" ? choice.id : presets[0].id);
  const [draft, setDraft] = useState<T>(choice.kind === "CUSTOM" ? choice.value : empty);

  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const gaps = missing(draft).filter(Boolean);

  const pickKind = (next: Kind) => {
    setKind(next);
    if (next === "RANDOM") onCommit({ kind: "RANDOM" });
    if (next === "PRESET") onCommit({ kind: "PRESET", id: preset.id });
    if (next === "CUSTOM" && choice.kind !== "CUSTOM") {
      // Start from the selected preset — easier to edit than a blank form.
      const start = fromPreset(preset);
      setDraft(start);
      if (missing(start).filter(Boolean).length === 0) onCommit({ kind: "CUSTOM", value: start });
    }
  };

  const commitDraft = () => {
    if (gaps.length > 0) return;
    if (choice.kind === "CUSTOM" && JSON.stringify(choice.value) === JSON.stringify(draft)) return;
    onCommit({ kind: "CUSTOM", value: draft });
  };

  return (
    <section className={styles.choice}>
      <h3 className={styles.choiceTitle}>
        {icon}
        {title}
      </h3>

      <div className={styles.kinds} role="radiogroup" aria-label={title}>
        {KINDS.map(({ kind: k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            disabled={disabled}
            className={cx(styles.kind, kind === k && styles.kindActive)}
            onClick={() => kind !== k && pickKind(k)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {kind === "RANDOM" && <p className={styles.note}>Выпадет одна из {presets.length} встроенных при старте игры.</p>}

      {kind === "PRESET" && (
        <>
          <Select
            aria-label={title}
            disabled={disabled}
            value={preset.id}
            onChange={(e) => {
              setPresetId(e.target.value);
              onCommit({ kind: "PRESET", id: e.target.value });
            }}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <div className={styles.preview}>{preview(preset)}</div>
        </>
      )}

      {kind === "CUSTOM" && (
        <fieldset
          className={styles.customForm}
          disabled={disabled}
          onBlur={(e) => {
            // Save once focus leaves the whole form, not on every field.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitDraft();
          }}
        >
          {form(draft, (patch) => setDraft((d) => ({ ...d, ...patch })))}
          {gaps.length > 0 && <span className={styles.warning}>Заполните: {gaps.join(", ")}</span>}
        </fieldset>
      )}
    </section>
  );
};
