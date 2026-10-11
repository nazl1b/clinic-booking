// "412 / 500" under a text field with a length limit. It changes while typing and
// screen readers hear it when they pause (aria-live="polite").

export function CharacterCount({ length, max }: { length: number; max: number }) {
  return (
    <span className="tabular" aria-live="polite">
      {length} / {max}
    </span>
  );
}
