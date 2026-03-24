import { Dumbbell, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: 'train' | 'progress' | 'history';
  onTabChange: (tab: 'train' | 'progress' | 'history') => void;
}

const tabs = [
  { id: 'train' as const, label: 'Train', icon: Dumbbell },
  { id: 'progress' as const, label: 'Progress', icon: TrendingUp },
  { id: 'history' as const, label: 'History', icon: Clock },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
      <div className="flex h-16 items-center justify-around px-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'flex min-h-[48px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-lg px-4 py-2 transition-colors',
              activeTab === id
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
