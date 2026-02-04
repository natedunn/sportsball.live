import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import type { TeamLeader } from "@/lib/types/team";

interface TopPerformersProps {
  leaders: TeamLeader[];
}

const categoryLabels: Record<string, string> = {
  ppg: "Points",
  rpg: "Rebounds",
  apg: "Assists",
};

export function TopPerformers({ leaders }: TopPerformersProps) {
  if (leaders.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5" />
        Team Leaders
      </h3>
      <Card classNames={{ inner: "flex-col p-0" }}>
        <div>
          {leaders.map((leader, index) => (
            <div
              key={`${leader.category}-${leader.player.id}`}
              className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${index < leaders.length - 1 ? "border-b border-border" : ""}`}
            >
              {/* Player headshot */}
              <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
                {leader.player.headshot ? (
                  <Image
                    src={leader.player.headshot}
                    alt={leader.player.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                    {leader.player.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                )}
              </div>

              {/* Player info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {leader.player.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {categoryLabels[leader.category]} Leader
                </div>
              </div>

              {/* Stat value */}
              <div className="text-right">
                <div className="text-xl font-bold tabular-nums">
                  {leader.value.toFixed(1)}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                  {leader.category}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
