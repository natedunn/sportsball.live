import { useEffect } from "react";
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
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { ConvexZenAuthProvider } from "convex-zen/react";

import { DefaultCatchBoundary } from "@/components/_default-catch-boundary";
import { authClient } from "@/lib/auth/auth-client";
import { initThemeObserver } from "@/lib/store";

import appCss from "../styles/app.css?url";
import { Footer } from "@/components/layout/footer";

const SITE_TITLE = import.meta.env.DEV ? "🚧 Sportsball" : "Sportsball";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	const { api } = await import("@/convex/_generated/api");
	const { fetchAuthMutation, getSession, getToken } = await import(
		"@/lib/auth/auth-server-utils"
	);
	const [token, session] = await Promise.all([getToken(), getSession()]);

	if (token) {
		try {
			await fetchAuthMutation(api.auth.syncCurrentUserToLocal, {});
		} catch (error) {
			console.warn("Failed to sync auth profile", error);
		}
	}

	return { token, session };
});

export const Route = createRootRouteWithContext<{
	convex: ConvexReactClient;
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
				title: SITE_TITLE,
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
			},
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
		],
	}),
	beforeLoad: async (ctx) => {
		const { token, session } = await getAuth();

		// During SSR only (the only time serverHttpClient exists),
		// set the auth token to make HTTP queries with.
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		return {
			isAuthenticated: session !== null,
			session,
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
		<ConvexZenAuthProvider
			client={authClient}
			initialSession={context.session}
		>
			<ConvexProvider client={context.convex}>
				<RootDocument>
					<Outlet />
				</RootDocument>
			</ConvexProvider>
		</ConvexZenAuthProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		initThemeObserver();
	}, []);

	return (
		<html suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="flex min-h-screen flex-col">
				<ScriptOnce>
					{`document.documentElement.classList.toggle(
						'dark',
						localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
					)`}
				</ScriptOnce>
				<div className="flex-1">{children}</div>
				<Footer />
				<Scripts />
			</body>
		</html>
	);
}
