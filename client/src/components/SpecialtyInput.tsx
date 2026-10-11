// Specialty field (Invite a doctor, Edit doctor): free text with the clinic's
// existing specialties as suggestions, so the admin picks one or types a new one.
// A native <datalist>: the browser shows the matching ones while typing and they
// are chosen with the arrow keys and Enter, like any browser list. A specialty
// typed in other letters ("cardiology") is saved the way it exists ("Cardiology")
// by the server.

import { useId, type ComponentProps } from 'react';

type SpecialtyInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'list'> & {
  value: string;
  onChange: (specialty: string) => void;
  suggestions: string[]; // from useSpecialties
};

export function SpecialtyInput({ value, onChange, suggestions, ...rest }: SpecialtyInputProps) {
  const listId = useId();
  return (
    <>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} list={listId} autoComplete="off" />
      <datalist id={listId}>
        {suggestions.map((specialty) => (
          <option key={specialty} value={specialty} />
        ))}
      </datalist>
    </>
  );
}
