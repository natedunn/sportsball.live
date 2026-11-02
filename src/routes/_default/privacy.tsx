import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { LegalPage, LegalSection } from "./-components/legal-page";

export const Route = createFileRoute("/_default/privacy")({
	head: () => ({
		meta: seo({
			title: "Privacy Policy",
			description: "What Sportsball collects, why, and who it is shared with.",
		}),
	}),
	component: PrivacyPage,
});

function PrivacyPage() {
	return (
		<LegalPage title="Privacy Policy" updated="November 1, 2026">
			<LegalSection title="The short version">
				<p>
					Sportsball doesn't run ads, analytics or tracking, and doesn't sell
					or share your data. You can use it without an account. If you sign
					in, it stores just enough to keep your account and favorite teams.
				</p>
			</LegalSection>

			<LegalSection title="If you sign in">
				<p>Signing in with Google gives Sportsball:</p>
				<ul>
					<li>Your name, email address and profile picture from Google</li>
					<li>A randomly generated username, which you can change</li>
					<li>The teams you favorite</li>
					<li>Sign-in sessions, so you stay signed in</li>
				</ul>
				<p>
					This is used only to run your account and show your profile and
					favorites. Sportsball never sees your Google password.
				</p>
			</LegalSection>

			<LegalSection title="Everyone else">
				<p>
					Like any website, the servers that deliver Sportsball see your IP
					address and basic browser details with each request. Request logs
					are kept for a limited time to fix bugs and stop abuse.
				</p>
				<p>
					Your browser also stores a few small settings, such as your time
					zone and light or dark theme. The{" "}
					<Link to="/cookies">cookies page</Link> lists each one.
				</p>
			</LegalSection>

			<LegalSection title="Services Sportsball uses">
				<ul>
					<li>
						<strong>Cloudflare</strong> hosts the site and handles every
						request.
					</li>
					<li>
						<strong>Convex</strong> stores account data and favorites.
					</li>
					<li>
						<strong>Google</strong> handles sign-in and serves the site's
						fonts.
					</li>
				</ul>
				<p>
					Scores and stats come from ESPN, but your browser doesn't talk to
					ESPN: Sportsball fetches the data on its servers, and team logos and
					player photos are passed through Sportsball too.
				</p>
			</LegalSection>

			<LegalSection title="Your choices">
				<ul>
					<li>Use Sportsball without signing in.</li>
					<li>Change your username and favorites at any time.</li>
					<li>
						Clear the site's cookies and storage in your browser. You'll be
						signed out and your settings reset.
					</li>
					<li>
						Ask for a copy of your data, or for your account and data to be
						deleted, using the contact below.
					</li>
				</ul>
			</LegalSection>

			<LegalSection title="Changes and contact">
				<p>
					If this policy changes, the date at the top will change with it.
					Questions or requests: reach out through{" "}
					<a
						href="https://github.com/natedunn"
						target="_blank"
						rel="noopener noreferrer"
					>
						github.com/natedunn
					</a>
					.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
