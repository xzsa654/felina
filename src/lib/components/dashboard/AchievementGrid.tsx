import type { Achievement } from "$lib/types";
import {
  Settings,
  Zap,
  Server,
  Network,
  Shield,
  Variable,
  MessageSquare,
  MessageCircle,
  MessagesSquare,
  Rocket,
  Trophy,
  Wrench,
  Flame,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Star,
  Award,
  Cog,
} from "lucide-react";

interface Props {
  achievements: Achievement[];
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Settings,
  Zap,
  Server,
  Network,
  Shield,
  Variable,
  MessageSquare,
  MessageCircle,
  MessagesSquare,
  Rocket,
  Trophy,
  Wrench,
  Flame,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Star,
  Award,
  Cog,
};

export default function AchievementGrid({ achievements }: Props) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
        Achievements{" "}
        <span className="text-text-muted">
          ({unlockedCount}/{achievements.length})
        </span>
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {achievements.map((achievement) => {
          const Icon = ICON_MAP[achievement.icon] ?? null;
          return (
            <div
              key={achievement.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                achievement.unlocked
                  ? "bg-accent/10 border-accent/30"
                  : "bg-bg-tertiary border-border opacity-40"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  achievement.unlocked
                    ? "bg-accent/20 text-accent"
                    : "bg-bg-tertiary text-text-muted"
                }`}
              >
                {Icon && <Icon size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">
                  {achievement.name}
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  {achievement.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
