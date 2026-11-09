// Readable team colors. A team's display colors are tuned for its own look, and
// some (dark blues and purples in dark mode, light teals in light mode) are hard
// to read on our cards. These helpers keep the hue and chroma and move only
// lightness (in OKLCH) until the color clears both bars below.
//
// WCAG 2's ratio alone isn't enough: it rates saturated dark blues on near-black
// as passing when they read poorly, so colors must also meet an APCA lightness
// contrast (Lc), which tracks how dark mode is actually perceived.

export type ColorMode = "light" | "dark";

/**
 * - `graphic`: bars, rings, fills; WCAG 1.4.11 asks 3:1
 * - `text`: team-colored text at normal size; WCAG 1.4.3 asks 4.5:1
 */
export type TeamColorUse = "graphic" | "text";

export const MIN_CONTRAST: Record<TeamColorUse, number> = {
	graphic: 3,
	text: 4.5,
};

/** APCA Lc minimums: 30 for non-text marks, 60 for content text */
export const MIN_APCA: Record<TeamColorUse, number> = {
	graphic: 30,
	text: 60,
};

// `--card` in src/styles/app.css: oklch(0.99 0 0) light, oklch(0.1 0 0) dark.
// For a neutral gray, OKLab L cubed is its relative luminance.
const CARD_LUMINANCE: Record<ColorMode, number> = {
	light: 0.99 ** 3,
	dark: 0.1 ** 3,
};

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
	const value = hex.replace(/^#/, "");
	const full =
		value.length === 3
			? value
					.split("")
					.map((char) => char + char)
					.join("")
			: value;
	const n = Number.parseInt(full, 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toHex([r, g, b]: Rgb): string {
	return [r, g, b]
		.map((channel) =>
			Math.round(Math.min(1, Math.max(0, channel)) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")
		.toUpperCase();
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function relativeLuminance(rgb: Rgb): number {
	const [r, g, b] = rgb.map(toLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// sRGB <-> OKLab (Björn Ottosson's matrices)
function rgbToOklab(rgb: Rgb): Rgb {
	const [r, g, b] = rgb.map(toLinear);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function oklabToRgb([L, a, b]: Rgb): Rgb {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	];
}

function inGamut(rgb: Rgb) {
	return rgb.every((channel) => channel >= -0.0005 && channel <= 1.0005);
}

/** WCAG contrast of a hex color (with or without `#`) against our card */
export function contrastOnCard(hex: string, mode: ColorMode): number {
	return contrast(relativeLuminance(parseHex(hex)), CARD_LUMINANCE[mode]);
}

// APCA 0.0.98G-4g screen luminance: a plain 2.4 power curve, black soft-clamped
function apcaLuminance([r, g, b]: Rgb): number {
	const y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
	return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
}

const CARD_RGB: Record<ColorMode, Rgb> = {
	light: [fromLinear(CARD_LUMINANCE.light), fromLinear(CARD_LUMINANCE.light), fromLinear(CARD_LUMINANCE.light)],
	dark: [fromLinear(CARD_LUMINANCE.dark), fromLinear(CARD_LUMINANCE.dark), fromLinear(CARD_LUMINANCE.dark)],
};

/** APCA lightness contrast (|Lc|, 0-106) of a hex color against our card */
export function apcaOnCard(hex: string, mode: ColorMode): number {
	const text = apcaLuminance(parseHex(hex));
	const background = apcaLuminance(CARD_RGB[mode]);
	if (Math.abs(background - text) < 0.0005) return 0;
	if (background > text) {
		const sapc = (background ** 0.56 - text ** 0.57) * 1.14;
		return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
	}
	const sapc = (background ** 0.65 - text ** 0.62) * 1.14;
	return sapc > -0.1 ? 0 : Math.abs(sapc + 0.027) * 100;
}

/** Whether a hex color is readable on our card for `use` */
export function isReadableOnCard(hex: string, mode: ColorMode, use: TeamColorUse): boolean {
	return contrastOnCard(hex, mode) >= MIN_CONTRAST[use] && apcaOnCard(hex, mode) >= MIN_APCA[use];
}

const cache = new Map<string, string>();

/**
 * The team color, adjusted only as far as needed to meet `use`'s contrast on
 * our card in `mode`. Returns uppercase hex without `#`, like the team registry.
 * Colors that already pass come back unchanged.
 */
export function readableTeamColor(
	hex: string,
	mode: ColorMode,
	use: TeamColorUse = "text",
): string {
	const key = `${hex}|${mode}|${use}`;
	const cached = cache.get(key);
	if (cached) return cached;

	const original = parseHex(hex);
	let result = toHex(original);

	if (!isReadableOnCard(result, mode, use)) {
		const [L, a, b] = rgbToOklab(original);
		const chroma = Math.hypot(a, b);
		const hue = Math.atan2(b, a);
		// Dark cards need a lighter color, light cards a darker one
		const step = mode === "dark" ? 0.005 : -0.005;

		for (let nextL = L + step; nextL >= 0 && nextL <= 1; nextL += step) {
			// Near white or black the hue can't hold its full chroma; shed only
			// as much as it takes to stay inside sRGB
			let c = chroma;
			let rgb = oklabToRgb([nextL, c * Math.cos(hue), c * Math.sin(hue)]);
			while (!inGamut(rgb) && c > 0) {
				c = Math.max(0, c - 0.005);
				rgb = oklabToRgb([nextL, c * Math.cos(hue), c * Math.sin(hue)]);
			}
			const candidate = toHex(rgb);
			if (isReadableOnCard(candidate, mode, use)) {
				result = candidate;
				break;
			}
		}
	}

	cache.set(key, result);
	return result;
}
