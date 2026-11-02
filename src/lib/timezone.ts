import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";

/** Cookie holding the visitor's IANA time zone, e.g. "America/Chicago". */
export const TIME_ZONE_COOKIE = "tz";

/** Used when neither the cookie nor Cloudflare can tell us. Game dates are Eastern. */
export const DEFAULT_TIME_ZONE = "America/New_York";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isValidTimeZone(timeZone: string | undefined | null): timeZone is string {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
}

function browserTimeZone(): string {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

/**
 * The visitor's time zone. The browser knows it; during SSR the server reads
 * the `tz` cookie the browser set, then Cloudflare's IP-based guess (first
 * visits), then falls back to US Eastern. Keeps SSR and the browser on the
 * same "today" and the same game times.
 */
export const getUserTimeZone = createIsomorphicFn()
	.server((): string => {
		const fromCookie = getCookie(TIME_ZONE_COOKIE);
		if (isValidTimeZone(fromCookie)) return fromCookie;

		const cf = (getRequest() as Request & { cf?: { timezone?: string } }).cf;
		if (isValidTimeZone(cf?.timezone)) return cf.timezone;

		return DEFAULT_TIME_ZONE;
	})
	.client(browserTimeZone);

/** Writes the browser's time zone to the `tz` cookie when it is missing or stale. */
export function syncTimeZoneCookie() {
	const timeZone = browserTimeZone();
	const current = document.cookie
		.split("; ")
		.find((part) => part.startsWith(`${TIME_ZONE_COOKIE}=`))
		?.slice(TIME_ZONE_COOKIE.length + 1);
	if (current && decodeURIComponent(current) === timeZone) return;

	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}
