// Search box with a magnifying glass inside, on the left. Used for every search
// in the app. Search boxes sit in toolbars without a visible label, so `label`
// names the field for screen readers (the placeholder is only an example).

import type { ComponentProps } from 'react';
import { Icon } from '../layout/Icon';

type SearchInputProps = Omit<ComponentProps<'input'>, 'type' | 'aria-label'> & {
  label: string;
};

// `className` goes on the wrapper, so pages size the whole box (e.g. filters-search).
export function SearchInput({ label, className, ...inputProps }: SearchInputProps) {
  return (
    <div className={`search-input${className ? ` ${className}` : ''}`}>
      <Icon name="search" size={18} />
      <input {...inputProps} type="search" aria-label={label} />
    </div>
  );
}
