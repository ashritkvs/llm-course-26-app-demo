import { createHash } from 'crypto';

export function getGravatar(email: string): string {
  const hash = createHash('sha256');
  hash.update(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash.digest('hex')}?d=mp&s=500`;
}

export function getNameInitials(name: string) {
  if (!name) return '';

  const words = name.trim().split(' ');

  const firstInitial = words?.[0]?.[0]?.toUpperCase();
  if (words.length === 1) return firstInitial;

  const lastInitial = words?.[words.length - 1]?.[0]?.toUpperCase();
  return firstInitial + lastInitial;
}
