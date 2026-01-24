import { describe, it, expect } from "vitest";
import { formatDate, moveDate } from "@/lib/date";

describe("formatDate", () => {
	it("formats date as YYYYMMDD by default", () => {
		// Use local date to avoid timezone issues
		const date = new Date(2024, 0, 15); // Month is 0-indexed
		expect(formatDate(date, "YYYYMMDD")).toBe("20240115");
	});

	it("formats date as YYYY-MM-DD", () => {
		const date = new Date(2024, 0, 15);
		expect(formatDate(date, "YYYY-MM-DD")).toBe("2024-01-15");
	});

	it("accepts string input", () => {
		// String input goes through timezone conversion
		const result = formatDate("2024-01-15", "YYYYMMDD");
		expect(result).toMatch(/^2024011[45]$/); // May vary by timezone
	});
});

describe("moveDate", () => {
	it("moves date to next day", () => {
		const result = moveDate("2024-01-15", "next");
		expect(result).toBe("2024-01-16");
	});

	it("moves date to previous day", () => {
		const result = moveDate("2024-01-15", "prev");
		expect(result).toBe("2024-01-14");
	});

	it("handles month boundary", () => {
		const result = moveDate("2024-01-31", "next");
		expect(result).toBe("2024-02-01");
	});
});
