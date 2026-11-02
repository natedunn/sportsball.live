import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { TIME_ZONE_COOKIE } from "@/lib/timezone";
import { LegalPage, LegalSection } from "./-components/legal-page";

export const Route = createFileRoute("/_default/cookies")({
	head: () => ({
		meta: seo({
			title: "Cookies",
			description: "Every cookie and piece of browser storage Sportsball uses.",
		}),
	}),
	component: CookiesPage,
});

interface StorageItem {
	name: string;
	purpose: string;
	duration: string;
}

const COOKIES: StorageItem[] = [
	{
		name: TIME_ZONE_COOKIE,
		purpose:
			"Your time zone, so pages show today's games and game times in your local time from the first load.",
		duration: "1 year",
	},
];

// Keys ending in "_…" get a suffix for the server they belong to.
const LOCAL_STORAGE: StorageItem[] = [
	{
		name: "__convexAuthJWT_…",
		purpose: "Short-lived sign-in token that proves who you are. Only when signed in.",
		duration: "Until you sign out",
	},
	{
		name: "__convexAuthRefreshToken_…",
		purpose: "Keeps you signed in between visits. Only when signed in.",
		duration: "Until you sign out",
	},
	{
		name: "__convexAuthProvider_…",
		purpose: "Temporary state while you sign in with Google.",
		duration: "Removed once sign-in finishes",
	},
	{
		name: "theme",
		purpose: "Your light or dark theme choice.",
		duration: "Until you clear it",
	},
	{
		name: "boxscore-group-by",
		purpose: "How box scores group players.",
		duration: "Until you clear it",
	},
	{
		name: "roster-visible-columns",
		purpose: "Which columns you show in team rosters.",
		duration: "Until you clear it",
	},
];

function StorageTable({ items }: { items: StorageItem[] }) {
	return (
		<div className="overflow-x-auto rounded-lg border border-border">
			<table className="w-full text-sm">
				<thead className="bg-muted/50 text-left text-foreground">
					<tr>
						<th className="px-3 py-2 font-medium">Name</th>
						<th className="px-3 py-2 font-medium">Purpose</th>
						<th className="px-3 py-2 font-medium">Kept for</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.name} className="border-t border-border align-top">
							<td className="px-3 py-2 font-mono text-xs text-foreground whitespace-nowrap">
								{item.name}
							</td>
							<td className="px-3 py-2">{item.purpose}</td>
							<td className="px-3 py-2 whitespace-nowrap">{item.duration}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function CookiesPage() {
	return (
		<LegalPage title="Cookies" updated="November 1, 2026">
			<LegalSection title="Overview">
				<p>
					Sportsball uses no advertising, analytics or tracking cookies. What
					it stores is needed for the site to work or remembers settings you
					chose. Nothing here is shared with anyone else. See the{" "}
					<Link to="/privacy">privacy policy</Link> for more.
				</p>
			</LegalSection>

			<LegalSection title="Cookies">
				<p>Sent to Sportsball's servers with each request.</p>
				<StorageTable items={COOKIES} />
			</LegalSection>

			<LegalSection title="Browser storage">
				<p>
					Kept in your browser's local storage and never sent with requests.
					Sign-in tokens are only sent to Sportsball's database when you're
					signed in.
				</p>
				<StorageTable items={LOCAL_STORAGE} />
			</LegalSection>

			<LegalSection title="Other services">
				<p>
					Signing in takes you to Google, which sets its own cookies under its
					own policy. Cloudflare, which hosts Sportsball, may set a security
					cookie if it needs to check for bots.
				</p>
			</LegalSection>

			<LegalSection title="Removing them">
				<p>
					You can clear Sportsball's cookies and storage in your browser's
					settings at any time. You'll be signed out and your settings will
					reset. The time zone cookie is set again on your next visit.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
