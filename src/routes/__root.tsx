import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	ScriptOnce,
	Scripts,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { DefaultCatchBoundary } from "@/components/_default-catch-boundary";
import { authClient } from "@/lib/auth/auth-client";
import { getToken } from "@/lib/auth/auth-server-utils";

import appCss from "../styles/app.css?url";
import { Header } from "@/components/layout/header";
// import { Devtools } from "./-components/devtools";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return await getToken();
});

// const convexPreconnect =
// 	import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_CONVEX_SITE_URL || undefined;

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Sportsball",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
			},
			// ...(convexPreconnect
			// 	? [{ rel: 'preconnect', href: convexPreconnect, crossOrigin: 'anonymous' as const }]
			// 	: []),
		],
	}),
	beforeLoad: async (ctx) => {
		const token = await getAuth();

		// During SSR only (the only time serverHttpClient exists),
		// set the auth token to make HTTP queries with.
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		return {
			isAuthenticated: !!token,
			token,
		};
	},
	errorComponent: DefaultCatchBoundary,
	notFoundComponent: () => <div>Not found</div>,
	component: RootComponent,
});

function RootComponent() {
	const context = useRouteContext({ from: Route.id });

	const router = useRouter();
	const isNotFound = router.state.matches.some(
		(match) => match.status === "notFound",
	);

	if (isNotFound) {
		return (
			<RootDocument>
				<Outlet />
			</RootDocument>
		);
	}

	return (
		<ConvexBetterAuthProvider
			client={context.convexQueryClient.convexClient}
			authClient={authClient}
			initialToken={context.token}
		>
			<RootDocument>
				<Outlet />
			</RootDocument>
		</ConvexBetterAuthProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ScriptOnce>
					{`document.documentElement.classList.toggle(
						'dark',
						localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
					)`}
				</ScriptOnce>
				{children}
				{/* {process.env.NODE_ENV === "development" && <Devtools />}s */}
				<Scripts />
			</body>
		</html>
	);
}
