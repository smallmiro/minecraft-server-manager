'use client';

import { ReactNode } from 'react';
import { BentoMetricCard } from '@/components/bento';

export interface StatCardProps {
  title: string;
  value: number;
  icon?: ReactNode;
  color?: 'primary' | 'success' | 'info' | 'secondary';
  description?: string;
  /** Optional unit/suffix rendered next to the value (e.g. "/ 8"). */
  unit?: string;
  /** Optional 0-100 ratio; renders an accent progress bar. Omit when no data. */
  progress?: number;
}

export function StatCard({
  title,
  value,
  icon,
  color = 'primary',
  description,
  unit,
  progress,
}: StatCardProps) {
  return (
    <BentoMetricCard
      title={title}
      value={value}
      unit={unit}
      icon={icon}
      accent={color}
      description={description}
      progress={progress}
    />
  );
}
