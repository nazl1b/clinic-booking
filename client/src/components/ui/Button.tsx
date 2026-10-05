// The only buttons used in the app. Three levels:
//   primary   – filled, the main action of a screen
//   secondary – outlined, other actions
//   tertiary  – underlined text, low-emphasis actions
// `danger` keeps the level but switches to the danger colour (cancel, deactivate).

import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'tertiary';

interface StyleProps {
  variant?: Variant;
  size?: 'md' | 'sm';
  danger?: boolean;
  block?: boolean; // full width
}

function buttonClass({ variant = 'primary', size = 'md', danger, block }: StyleProps, extra?: string): string {
  return ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', danger && 'btn-danger', block && 'btn-block', extra]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant, size, danger, block, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, danger, block }, className)} {...rest} />;
}

type ButtonLinkProps = StyleProps & LinkProps;

// A router link that looks like a button.
export function ButtonLink({ variant, size, danger, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, danger, block }, className)} {...rest} />;
}
