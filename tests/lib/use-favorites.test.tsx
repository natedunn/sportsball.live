import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockUseQuery = vi.fn();
let mutationFn: ReturnType<typeof vi.fn>;

vi.mock("@tanstack/react-query", () => ({
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@convex-dev/react-query", () => ({
	convexQuery: (...args: unknown[]) => ({ queryKey: args }),
	useConvexMutation: () => mutationFn,
}));

import { useFavorites } from "@/lib/use-favorites";

function FavoritesHarness() {
	const { favorites, toggleFavorite } = useFavorites();

	return (
		<div>
			<div data-testid="count">{favorites.length}</div>
			<button type="button" onClick={() => toggleFavorite("nba", "1", "atl")}>
				Toggle
			</button>
		</div>
	);
}

describe("useFavorites toggling", () => {
	beforeEach(() => {
		mockUseQuery.mockReset();
		mutationFn = vi.fn();
	});

	it("optimistically adds a favorite while mutation is pending", async () => {
		let resolveMutation: ((value: unknown) => void) | undefined;
		mutationFn = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveMutation = resolve;
				}),
		);

		mockUseQuery.mockReturnValue({ data: [], isLoading: false });

		render(<FavoritesHarness />);

		expect(screen.getByTestId("count")).toHaveTextContent("0");
		fireEvent.click(screen.getByRole("button", { name: /toggle/i }));
		expect(screen.getByTestId("count")).toHaveTextContent("1");

		await act(async () => {
			resolveMutation?.({ action: "added" });
		});

		expect(screen.getByTestId("count")).toHaveTextContent("0");
	});

	it("optimistically removes a favorite while mutation is pending", async () => {
		let resolveMutation: ((value: unknown) => void) | undefined;
		mutationFn = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveMutation = resolve;
				}),
		);

		mockUseQuery.mockReturnValue({
			data: [
				{
					_id: "fav-1",
					userId: "user-1",
					league: "nba",
					teamId: "1",
					teamSlug: "atl",
					addedAt: Date.now(),
				},
			],
			isLoading: false,
		});

		render(<FavoritesHarness />);

		expect(screen.getByTestId("count")).toHaveTextContent("1");
		fireEvent.click(screen.getByRole("button", { name: /toggle/i }));
		expect(screen.getByTestId("count")).toHaveTextContent("0");

		await act(async () => {
			resolveMutation?.({ action: "removed" });
		});
	});
});
