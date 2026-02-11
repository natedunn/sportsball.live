import { Link } from "@tanstack/react-router";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "~api";
import { convexQuery } from "@convex-dev/react-query";
import { LayoutDashboard, BarChart3, Trophy, Users, ShieldHalf, ChevronDown } from "lucide-react";
import { UserMenu } from "./user-menu";

function NavLink(props: NavigationMenu.Link.Props) {
	return (
		<NavigationMenu.Link
			render={<Link to={props.href as string} />}
			{...props}
		/>
	);
}

function ArrowSvg(props: React.ComponentProps<"svg">) {
	return (
		<svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
			<path
				d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
				className="fill-background"
			/>
			<path
				d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
				className="fill-border"
			/>
		</svg>
	);
}

const navItems = [
	{
		label: "NBA",
		href: "/nba",
		children: [
			{
				label: "Overview",
				href: "/nba",
				icon: LayoutDashboard,
				description: "News, scores, and stats",
			},
			{
				label: "Scores & Schedule",
				href: "/nba/scores",
				icon: BarChart3,
				description: "Live scores and upcoming games",
			},
			{
				label: "Standings",
				href: "/nba/standings",
				icon: Trophy,
				description: "Up-to-date league standings",
			},
			{
				label: "Teams",
				href: "/nba/teams",
				icon: ShieldHalf,
				description: "Team pages and rosters",
				disabled: true,
			},
			{
				label: "Players",
				href: "/nba/players",
				icon: Users,
				description: "Player stats and profiles",
				disabled: true,
			},
		],
	},
	{
		label: "WNBA",
		href: "/wnba",
		children: [
			{
				label: "Overview",
				href: "/wnba",
				icon: LayoutDashboard,
				description: "News, scores, and stats",
			},
			{
				label: "Scores & Schedule",
				href: "/wnba/scores",
				icon: BarChart3,
				description: "Live scores and upcoming games",
			},
			{
				label: "Standings",
				href: "/wnba/standings",
				icon: Trophy,
				description: "Up-to-date league standings",
			},
			{
				label: "Teams",
				href: "/wnba/teams",
				icon: ShieldHalf,
				description: "Team pages and rosters",
				disabled: true,
			},
			{
				label: "Players",
				href: "/wnba/players",
				icon: Users,
				description: "Player stats and profiles",
				disabled: true,
			},
		],
	},
	{
		label: "G League",
		href: "/gleague",
		children: [
			{
				label: "Overview",
				href: "/gleague",
				icon: LayoutDashboard,
				description: "News, scores, and stats",
			},
			{
				label: "Scores & Schedule",
				href: "/gleague/scores",
				icon: BarChart3,
				description: "Live scores and upcoming games",
			},
			{
				label: "Standings",
				href: "/gleague/standings",
				icon: Trophy,
				description: "Up-to-date league standings",
			},
			{
				label: "Teams",
				href: "/gleague/teams",
				icon: ShieldHalf,
				description: "Team pages and rosters",
				disabled: true,
			},
			{
				label: "Players",
				href: "/gleague/players",
				icon: Users,
				description: "Player stats and profiles",
				disabled: true,
			},
		],
	},
];

const triggerClassName =
	"inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent";

const positionerClassName =
	"z-9999 box-border h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-(--duration) ease-(--easing) data-instant:transition-none";

const popupClassName =
	"relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-lg border border-border bg-background shadow-lg transition-[opacity,transform,width,height,scale,translate] duration-(--duration) ease-(--easing) data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0";

const arrowClassName =
	"flex transition-[left] duration-(--duration) ease-(--easing) data-[side=bottom]:-top-2 data-[side=top]:-bottom-2 data-[side=top]:rotate-180";

const viewportClassName = "relative h-full w-full overflow-hidden";

const contentClassName =
	"h-full p-2 w-105 transition-[opacity,transform,translate] duration-(--duration) ease-(--easing) data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:data-[activation-direction=left]:-translate-x-1/2 data-starting-style:data-[activation-direction=right]:translate-x-1/2 data-ending-style:data-[activation-direction=left]:translate-x-1/2 data-ending-style:data-[activation-direction=right]:-translate-x-1/2";

export function Header() {
	const { data: user } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);

	return (
		<nav className="relative z-50 border-b border-border bg-background py-2 backdrop-blur-xl">
			<div className="container flex items-center justify-between">
				<Link
					to="/"
					className="group inline-flex items-center justify-center gap-2 px-2 py-2"
				>
					<span className="py-0.5 text-lg leading-none">🏀</span>
					<span className="group-hover:underline group-focus:underline">
						Sportsball
					</span>
					<span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
						BETA
					</span>
				</Link>

				{/* Desktop nav - centered */}
				<NavigationMenu.Root className="absolute left-1/2 -translate-x-1/2 hidden sm:block">
					<NavigationMenu.List className="flex items-center gap-1">
						{navItems.map((item) => (
							<NavigationMenu.Item key={item.label}>
								<NavigationMenu.Trigger className={triggerClassName}>
									{item.label}
									<NavigationMenu.Icon className="transition-transform duration-200 ease-out data-popup-open:rotate-180">
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									</NavigationMenu.Icon>
								</NavigationMenu.Trigger>
								<NavigationMenu.Content className={contentClassName}>
									<ul className="grid grid-cols-2 gap-1">
										{item.children.map((child) => (
											<li key={child.href}>
												{child.disabled ? (
													<div className="flex h-full items-start gap-3 rounded-md p-3 opacity-50 cursor-not-allowed">
														<child.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
														<div className="flex flex-col gap-0.5">
															<span className="text-sm font-medium">
																{child.label}
															</span>
															<span className="text-xs text-muted-foreground">
																{child.disabled ? "Coming soon" : child.description}
															</span>
														</div>
													</div>
												) : (
													<NavLink
														href={child.href}
														className="flex h-full items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent/50 focus:bg-accent/50 focus:outline-none"
													>
														<child.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
														<div className="flex flex-col gap-0.5">
															<span className="text-sm font-medium">
																{child.label}
															</span>
															<span className="text-xs text-muted-foreground">
																{child.description}
															</span>
														</div>
													</NavLink>
												)}
											</li>
										))}
									</ul>
								</NavigationMenu.Content>
							</NavigationMenu.Item>
						))}
					</NavigationMenu.List>

						<NavigationMenu.Portal>
							<NavigationMenu.Positioner
								sideOffset={8}
								className={positionerClassName}
								style={
									{
										"--duration": "0.35s",
										"--easing": "cubic-bezier(0.22, 1, 0.36, 1)",
									} as React.CSSProperties
								}
							>
								<NavigationMenu.Popup className={popupClassName}>
									<NavigationMenu.Arrow className={arrowClassName}>
										<ArrowSvg />
									</NavigationMenu.Arrow>
									<NavigationMenu.Viewport className={viewportClassName} />
								</NavigationMenu.Popup>
							</NavigationMenu.Positioner>
						</NavigationMenu.Portal>
					</NavigationMenu.Root>

				{/* Mobile nav links */}
				<div className="flex items-center gap-2 sm:hidden">
					<Link
						to="/nba"
						className="inline-flex px-2 py-2 text-sm hover:underline focus:underline"
					>
						NBA
					</Link>
					<Link
						to="/wnba"
						className="inline-flex px-2 py-2 text-sm hover:underline focus:underline"
					>
						WNBA
					</Link>
					<Link
						to="/gleague"
						className="inline-flex px-2 py-2 text-sm hover:underline focus:underline"
					>
						G League
					</Link>
				</div>

				<div className="flex items-center">
					{user ? (
						<UserMenu user={user} />
					) : (
						<Link
							to="/auth/sign-in"
							className="inline-flex rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							Sign In
						</Link>
					)}
				</div>
			</div>
		</nav>
	);
}
