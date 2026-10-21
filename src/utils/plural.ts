/** Russian plural form: plural(5, ["место", "места", "мест"]) → "мест". */
export const plural = (n: number, [one, few, many]: readonly [string, string, string]) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/** "5 мест", "2 места", "1 место". */
export const count = (n: number, forms: readonly [string, string, string]) => `${n} ${plural(n, forms)}`;
