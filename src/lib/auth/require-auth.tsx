import { useEffect, type ReactNode } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { api } from "~api";

/**
 * Client-side route guard. Convex Auth keeps the session in the browser, so
 * the server can't tell who is signed in; pages render once the client knows.
 * Convex functions still check auth themselves, so this only controls UI.
 */
export function RequireAuth({
	admin = false,
	children,
}: {
	admin?: boolean;
	children: ReactNode;
}) {
	const { isLoading, isAuthenticated } = useConvexAuth();
	const navigate = useNavigate();
	const { data: isAdmin, isPending: adminPending } = useQuery({
		...convexQuery(api.admin.checkIsAdmin, {}),
		enabled: admin && isAuthenticated,
	});

	const allowed = isAuthenticated && (!admin || isAdmin === true);

	useEffect(() => {
		if (isLoading) return;
		if (!isAuthenticated) {
			navigate({ to: "/auth/sign-in", replace: true });
		} else if (admin && !adminPending && !isAdmin) {
			navigate({ to: "/", replace: true });
		}
	}, [isLoading, isAuthenticated, admin, adminPending, isAdmin, navigate]);

	if (isLoading || !allowed) return null;
	return <>{children}</>;
}
