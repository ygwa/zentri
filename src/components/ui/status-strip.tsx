
import { cn } from '@/lib/utils';

interface StatusStripProps {
  status: 'healthy' | 'orphan' | 'hub' | 'stub';
  className?: string;
}

export function StatusStrip({ status, className }: StatusStripProps) {
  const colors = {
    healthy: 'bg-emerald-500',
    orphan: 'bg-rose-500',
    hub: 'bg-violet-500',
    stub: 'bg-zinc-300'
  };

  return (
    <div className={cn(
      'w-[2px] h-full absolute left-0 top-0 bottom-0',
      colors[status] || 'bg-zinc-300',
      className
    )} />
  );
}

