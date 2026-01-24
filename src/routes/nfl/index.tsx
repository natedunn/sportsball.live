import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/nfl/")({
  component: NflPage,
});

function NflPage() {
  return (
    <div className="flex flex-col gap-8 pb-12 lg:pb-20">
      <div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
        <div className="flex flex-col items-center justify-between gap-2">
          <h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
            NFL Scores
          </h1>
          <p className="text-muted-foreground/50">Coming soon</p>
        </div>
      </div>
      <div className="container">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="mt-4 text-lg text-muted-foreground/50">
            NFL scores will be available during the season
          </div>
        </div>
      </div>
    </div>
  );
}
