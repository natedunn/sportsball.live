import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Header } from "~/components/layout/header";
import { Footer } from "~/components/layout/footer";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-auto">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
