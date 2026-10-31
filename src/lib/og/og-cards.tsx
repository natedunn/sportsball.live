// Social card layouts (1200×630), rendered to PNG by satori in the
// /api/og/* routes. Satori supports a subset of CSS: every element with more
// than one child needs `display: flex`, and there is no grid.

import type { ReactNode } from "react";
import basketballStill from "./basketball-still.png?inline";
import {
	Activity,
	BarChart3,
	Calendar,
	Flame,
	History,
	House,
	ListOrdered,
	TrendingUp,
	Trophy,
	Users,
	type LucideIcon,
} from "lucide-react";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const colors = {
	background: "#000000",
	foreground: "#ffffff",
	muted: "#a3a3a3",
	border: "#262626",
	card: "#0a0a0a",
	orange: "#f97316",
};

// ============================================================
// Shared pieces
// ============================================================

/** Small deterministic PRNG, so a team's grid looks the same on every render */
function mulberry32(seed: number) {
	return () => {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hashString(value: string) {
	let hash = 0;
	for (const char of value) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
	return hash;
}

/** A still frame of the site's flickering square grid, as an SVG data URI */
function dotGridUri(color: string, seed: string, maxOpacity = 0.7) {
	const square = 6;
	const step = 14;
	const random = mulberry32(hashString(seed));
	let rects = "";
	for (let y = 0; y < OG_HEIGHT; y += step) {
		for (let x = 0; x < OG_WIDTH; x += step) {
			const opacity = (random() * maxOpacity).toFixed(2);
			rects += `<rect x="${x}" y="${y}" width="${square}" height="${square}" fill-opacity="${opacity}"/>`;
		}
	}
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}"><g fill="${color}">${rects}</g></svg>`;
	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function DotGrid({
	color,
	seed,
	fade,
}: {
	color: string;
	seed: string;
	/** CSS gradient laid over the grid to fade it into the background */
	fade: string;
}) {
	return (
		<div style={{ position: "absolute", top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, display: "flex" }}>
			<img src={dotGridUri(color, seed)} width={OG_WIDTH} height={OG_HEIGHT} />
			<div style={{ position: "absolute", top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, backgroundImage: fade }} />
		</div>
	);
}

function BrandMark({ size = 32 }: { size?: number }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: size * 0.4 }}>
			<span style={{ fontSize: size * 1.05 }}>🏀</span>
			<span style={{ fontSize: size, fontWeight: 600, color: colors.foreground }}>
				Sportsball
			</span>
		</div>
	);
}

function Frame({ children, background }: { children: ReactNode; background?: ReactNode }) {
	return (
		<div
			style={{
				position: "relative",
				display: "flex",
				width: OG_WIDTH,
				height: OG_HEIGHT,
				backgroundColor: colors.background,
				color: colors.foreground,
				fontFamily: "Inter",
			}}
		>
			{background}
			<div
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					padding: "48px 64px",
				}}
			>
				{children}
			</div>
		</div>
	);
}

function TopBar({ label }: { label?: string }) {
	return (
		<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
			<BrandMark />
			{label && (
				<span style={{ fontSize: 26, fontWeight: 600, color: colors.muted }}>{label}</span>
			)}
		</div>
	);
}

// ============================================================
// Home
// ============================================================

/**
 * The home page's dithered ball (DitheredBasketball) as a still: same sphere,
 * texture, lights and 4x4 Bayer dither, rendered offline with 2x the exposure.
 * A frozen frame at the site's exposure only lights the lowest dither levels,
 * an even dot grid; the extra levels bring out the shading and texture. Shown
 * at its own size so the 4px squares stay crisp.
 */
const BALL_SIZE = { width: 946, height: 943 };
/** Keeps the text readable over the ball's texture */
const TEXT_GLOW = "0 0 18px #000, 0 0 36px #000";

export function HomeCard() {
	return (
		<Frame
			background={
				<img
					src={basketballStill}
					width={BALL_SIZE.width}
					height={BALL_SIZE.height}
					style={{
						position: "absolute",
						left: (OG_WIDTH - BALL_SIZE.width) / 2,
						top: -500,
						opacity: 0.55,
					}}
				/>
			}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					flex: 1,
					gap: 28,
				}}
			>
				<span style={{ fontSize: 132, fontWeight: 800, letterSpacing: -4, textShadow: TEXT_GLOW }}>
					Sportsball
				</span>
				<span style={{ fontSize: 36, color: "#d4d4d4", textShadow: TEXT_GLOW }}>
					Live scores, standings and stats
				</span>
				<div style={{ display: "flex", gap: 16, marginTop: 12 }}>
					{["NBA", "WNBA", "G League"].map((league) => (
						<span
							key={league}
							style={{
								fontSize: 28,
								fontWeight: 600,
								padding: "10px 28px",
								borderRadius: 999,
								border: `2px solid ${colors.border}`,
								backgroundColor: colors.card,
							}}
						>
							{league}
						</span>
					))}
				</div>
			</div>
		</Frame>
	);
}

// ============================================================
// Feature chips: what the page has, not live numbers, so a card that a chat
// app keeps for weeks never goes out of date
// ============================================================

export interface CardFeature {
	label: string;
	icon: LucideIcon;
}

function FeatureChips({ features }: { features: CardFeature[] }) {
	return (
		<div style={{ display: "flex", gap: 14 }}>
			{features.map(({ label, icon: Icon }) => (
				<div
					key={label}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: "14px 24px",
						borderRadius: 999,
						border: `2px solid ${colors.border}`,
						backgroundColor: "rgba(10,10,10,0.85)",
						fontSize: 26,
						fontWeight: 600,
					}}
				>
					<Icon size={26} color={colors.muted} strokeWidth={2} />
					{label}
				</div>
			))}
		</div>
	);
}

// ============================================================
// Team
// ============================================================

export interface TeamCardData {
	leagueLabel: string;
	season?: string;
	city: string;
	name: string;
	logoUrl: string;
	/** Hex without `#` */
	color: string;
}

const TEAM_FEATURES: CardFeature[] = [
	{ label: "Schedule", icon: Calendar },
	{ label: "Roster", icon: Users },
	{ label: "Stats", icon: BarChart3 },
	{ label: "Trends", icon: TrendingUp },
	{ label: "Injuries", icon: Activity },
];

export function TeamCard({ data }: { data: TeamCardData }) {
	const color = `#${data.color}`;
	return (
		<Frame
			background={
				<>
					<DotGrid
						color={color}
						seed={data.name}
						fade={`linear-gradient(90deg, ${colors.background} 35%, rgba(0,0,0,0.75) 65%, rgba(0,0,0,0.35) 100%)`}
					/>
					<div
						style={{
							position: "absolute",
							left: -200,
							top: -100,
							width: 900,
							height: 830,
							backgroundImage: `radial-gradient(circle at 50% 50%, ${color}2e 0%, ${color}00 60%)`,
						}}
					/>
				</>
			}
		>
			<TopBar label={[data.leagueLabel, data.season].filter(Boolean).join(" · ")} />

			<div style={{ display: "flex", alignItems: "center", gap: 56, flex: 1 }}>
				<img src={data.logoUrl} width={240} height={240} style={{ objectFit: "contain" }} />
				<div style={{ display: "flex", flexDirection: "column" }}>
					<span
						style={{
							fontSize: 30,
							fontWeight: 600,
							color: colors.muted,
							textTransform: "uppercase",
							letterSpacing: 3,
						}}
					>
						{data.city}
					</span>
					<span style={{ fontSize: 112, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>
						{data.name}
					</span>
				</div>
			</div>

			<FeatureChips features={TEAM_FEATURES} />
		</Frame>
	);
}

// ============================================================
// Standings
// ============================================================

export interface StandingsCardData {
	leagueLabel: string;
	season?: string;
	/** e.g. "Western Conference"; the whole league when unset */
	conference?: string;
	logoUrls: string[];
}

const STANDINGS_FEATURES: CardFeature[] = [
	{ label: "Records", icon: Trophy },
	{ label: "Games back", icon: ListOrdered },
	{ label: "Home & away", icon: House },
	{ label: "Last 10", icon: History },
	{ label: "Streaks", icon: Flame },
];

/** Logos in at most two rows, as large as fits */
function LogoWall({ logoUrls }: { logoUrls: string[] }) {
	const gap = 16;
	const perRow = logoUrls.length > 12 ? Math.ceil(logoUrls.length / 2) : logoUrls.length;
	const size = Math.min(72, Math.floor((OG_WIDTH - 128 - (perRow - 1) * gap) / perRow));
	const rows = [logoUrls.slice(0, perRow), logoUrls.slice(perRow)].filter((row) => row.length);
	return (
		<div style={{ display: "flex", flexDirection: "column", gap }}>
			{rows.map((row, index) => (
				<div key={index} style={{ display: "flex", gap }}>
					{row.map((url) => (
						<img key={url} src={url} width={size} height={size} />
					))}
				</div>
			))}
		</div>
	);
}

export function StandingsCard({ data }: { data: StandingsCardData }) {
	return (
		<Frame
			background={
				<DotGrid
					color={colors.orange}
					seed={`${data.leagueLabel}-${data.conference ?? "league"}`}
					fade={`linear-gradient(180deg, rgba(0,0,0,0.4) 0%, ${colors.background} 45%, ${colors.background} 100%)`}
				/>
			}
		>
			<TopBar label={data.season} />
			<div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
				{data.conference && (
					<span style={{ fontSize: 30, fontWeight: 600, color: colors.muted }}>
						{data.conference}
					</span>
				)}
				<span style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>
					{data.leagueLabel} Standings
				</span>
			</div>
			<div style={{ display: "flex", flex: 1, marginTop: 28 }}>
				<LogoWall logoUrls={data.logoUrls} />
			</div>
			<FeatureChips features={STANDINGS_FEATURES} />
		</Frame>
	);
}
