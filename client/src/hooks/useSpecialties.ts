// The specialties doctors and pending invitations already have, for the
// SpecialtyInput suggestions. Bump `reloadKey` after a save that may add one.
// If they cannot be loaded the field still works, just without suggestions.

import { useEffect, useState } from 'react';
import { getSpecialties } from '../api/admin';

export function useSpecialties(reloadKey = 0): string[] {
  const [specialties, setSpecialties] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;
    getSpecialties()
      .then((list) => !ignore && setSpecialties(list))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  return specialties;
}
