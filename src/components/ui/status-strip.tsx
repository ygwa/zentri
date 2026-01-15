
import { cn } from '@/lib/utils';

interface StatusStripProps {
  status: 'healthy' | 'orphan' | 'hub' | 'stub';
  className?: string;
  /** 是否显示为标签样式（默认true） */
  asBadge?: boolean;
}

export function StatusStrip({ status, className, asBadge = true }: StatusStripProps) {
  // 使用低饱和度的莫兰迪色系
  const badgeColors = {
    healthy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    orphan: 'bg-rose-100 text-rose-700 border-rose-200',
    hub: 'bg-violet-100 text-violet-700 border-violet-200',
    stub: 'bg-zinc-100 text-zinc-600 border-zinc-200'
  };

  const stripColors = {
    healthy: 'bg-emerald-300',
    orphan: 'bg-rose-300',
    hub: 'bg-violet-300',
    stub: 'bg-zinc-300'
  };

  const labels = {
    healthy: 'Healthy',
    orphan: 'Orphan',
    hub: 'Hub',
    stub: 'Stub'
  };

  if (asBadge) {
    return (
      <span className={cn(
        'text-[9px] font-medium px-1.5 py-0.5 rounded-sm border',
        badgeColors[status] || badgeColors.stub,
        className
      )}>
        {labels[status]}
      </span>
    );
  }

  // 保留细线样式作为备选
  return (
    <div className={cn(
      'w-[1px] h-full absolute left-0 top-0 bottom-0',
      stripColors[status] || 'bg-zinc-300',
      className
    )} />
  );
}

