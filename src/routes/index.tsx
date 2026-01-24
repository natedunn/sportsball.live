import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex flex-col gap-8 pb-12 lg:pb-20">
      <div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
        <div className="flex flex-col items-center justify-between gap-4">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
            Sportsball.live
          </h1>
          <p className="text-center text-muted-foreground/50">
            Your source for live sports scores
          </p>
        </div>
      </div>
      <div className="container">
        <div className="flex flex-col items-center gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/nba"
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 transition-colors hover:bg-accent"
            >
              <span className="text-2xl font-bold">NBA</span>
              <span className="text-muted-foreground">Basketball scores</span>
            </Link>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 opacity-50">
              <span className="text-2xl font-bold">NFL</span>
              <span className="text-muted-foreground">Coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
