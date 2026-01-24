import type { ErrorComponentProps } from "@tanstack/react-router";

import {
	ErrorComponent,
	Link,
	rootRouteId,
	useMatch,
	useRouter,
} from "@tanstack/react-router";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	console.error(error);

	return (
		<div className="mx-auto flex w-full max-w-300 flex-1 flex-col items-center gap-2 p-4">
			<div className="w-full text-2xl font-bold">
				<ErrorComponent error={error} />
			</div>
			<div className="flex w-full flex-wrap items-start gap-2">
				<button
					onClick={() => {
						router.invalidate();
					}}
					className={`rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
				>
					Try Again
				</button>
				{isRoot ? (
					<Link
						to="/"
						className={`rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
					>
						Home
					</Link>
				) : (
					<Link
						to="/"
						className={`rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
						onClick={(e) => {
							e.preventDefault();
							window.history.back();
						}}
					>
						Go Back
					</Link>
				)}
			</div>
		</div>
	);
}
