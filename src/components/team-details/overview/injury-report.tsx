import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { HeartPulse } from "lucide-react";
import { SectionHeader } from "../section-header";
import type { InjuredPlayer } from "@/lib/types/team";

function formatPlayerName(name: string): string {
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return `${firstName[0]}. ${lastName}`;
}

interface InjuryReportProps {
  injuries: InjuredPlayer[];
}

const statusColors: Record<string, string> = {
  Out: "text-red-600 dark:text-red-400",
  Doubtful: "text-orange-600 dark:text-orange-400",
  Questionable: "text-yellow-600 dark:text-yellow-400",
  Probable: "text-green-600 dark:text-green-400",
  "Day-To-Day": "text-yellow-600 dark:text-yellow-400",
};

export function InjuryReport({ injuries }: InjuryReportProps) {
  return (
    <div>
      <SectionHeader
        icon={HeartPulse}
        title="Injury Report"
        badge={injuries.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {injuries.length}
          </span>
        )}
      />
      <Card classNames={{ inner: "flex-col p-0" }}>
        {injuries.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No injuries to report
          </div>
        ) : (
          <div>
            {injuries.map((player, index) => {
              const content = (
                <div
                  className={`flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-default ${index < injuries.length - 1 ? "border-b border-border" : ""}`}
                >
                  {/* Player headshot */}
                  <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
                    {player.headshot ? (
                      <Image
                        src={player.headshot}
                        alt={player.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                        {player.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                    )}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm">
                      <span className="font-medium">{formatPlayerName(player.name)}</span>
                      <span className="text-muted-foreground/50 mx-1.5">•</span>
                      <span className={`text-xs ${statusColors[player.status] || "text-muted-foreground"}`}>
                        {player.status}
                      </span>
                    </div>
                    {player.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {player.description}
                      </div>
                    )}
                  </div>
                </div>
              );

              if (player.shortComment) {
                return (
                  <Tooltip
                    key={player.id}
                    content={
                      <div className="max-w-[280px] text-xs leading-relaxed text-left">
                        {player.shortComment}
                      </div>
                    }
                    side="top"
                    delay={0}
                    closeDelay={0}
                    hoverable={false}
                    className="block w-full text-left"
                  >
                    {content}
                  </Tooltip>
                );
              }

              return <div key={player.id}>{content}</div>;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
