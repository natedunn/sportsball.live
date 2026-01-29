import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Score } from "@/components/scores/score";

describe("Score component", () => {
	it("renders both scores", () => {
		render(<Score homeScore={100} awayScore={98} gameState="post" />);
		expect(screen.getByText("100")).toBeInTheDocument();
		expect(screen.getByText("98")).toBeInTheDocument();
	});

	it("shows winner with full opacity and loser with reduced opacity", () => {
		const { container } = render(
			<Score homeScore={100} awayScore={98} gameState="post" />,
		);
		const scores = container.querySelectorAll(".font-mono");
		// Away score (98) is the loser, should have opacity-50
		expect(scores[0]).toHaveClass("opacity-50");
		// Home score (100) is the winner, should not have opacity-50
		expect(scores[1]).not.toHaveClass("opacity-50");
	});

	it("shows both teams active during game", () => {
		const { container } = render(
			<Score homeScore={50} awayScore={48} gameState="in" />,
		);
		const scores = container.querySelectorAll(".font-mono");
		expect(scores[0]).not.toHaveClass("opacity-50");
		expect(scores[1]).not.toHaveClass("opacity-50");
	});
});
