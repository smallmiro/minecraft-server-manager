import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS classes.
 * Combines clsx for conditional classes and tailwind-merge for deduplication.
 *
 * @example
 * cn('px-4 py-2', 'bg-blue-500', isActive && 'bg-blue-700')
 * cn('text-sm', className) // Allow override from props
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
