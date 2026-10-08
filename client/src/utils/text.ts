// Small text helpers shared by the pages.

// plural(1, 'appointment') → "1 appointment", plural(3, 'appointment') → "3 appointments"
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Letter for an avatar: "Dr. Maria Papadopoulou" → "M"
export function initialOf(name: string): string {
  return name.replace(/^Dr\.\s*/, '').charAt(0);
}
