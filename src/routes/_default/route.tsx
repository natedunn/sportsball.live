import { Header } from "@/components/layout/header";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_default")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<Header />
			<div>
				<Outlet />
			</div>
		</>
	);
}
