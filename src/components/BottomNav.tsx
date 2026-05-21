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
    <nav className="lb-bottom-nav">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={cn('lb-bn-item', activeTab === id && 'is-active')}
        >
          <Icon className="h-5 w-5" strokeWidth={1.6} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
