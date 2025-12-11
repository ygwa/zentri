import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'blue' | 'red' | 'green' | 'purple' | 'mono';
  className?: string;
}

export function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  const styles = {
    gray: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    mono: 'bg-zinc-800 text-zinc-300 border-zinc-700 font-mono text-[9px]',
  };
  
  return (
    <span className={cn(
      'px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold rounded-sm border',
      styles[color],
      className
    )}>
      {children}
    </span>
  );
}

