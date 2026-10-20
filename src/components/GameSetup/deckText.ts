import type { CardItem } from "../../api/types";

/** "Значение | описание" per line — easy to type and to paste whole lists. */
const SEPARATOR = "|";

export const itemsToText = (items: CardItem[]) =>
  items.map((item) => (item.description ? `${item.value} ${SEPARATOR} ${item.description}` : item.value)).join("\n");

export const textToItems = (text: string): CardItem[] =>
  text
    .split("\n")
    .map((line) => {
      const at = line.indexOf(SEPARATOR);
      const value = (at === -1 ? line : line.slice(0, at)).trim();
      const description = at === -1 ? "" : line.slice(at + 1).trim();
      return description ? { value, description } : { value };
    })
    .filter((item) => item.value);
