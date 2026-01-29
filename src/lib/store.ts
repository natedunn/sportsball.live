import { Store } from "@tanstack/store";

interface AppState {
	isDarkMode: boolean;
}

function getInitialDarkMode(): boolean {
	if (typeof document === "undefined") return false;
	return document.documentElement.classList.contains("dark");
}

export const appStore = new Store<AppState>({
	isDarkMode: getInitialDarkMode(),
});

// Initialize theme observer (call once at app startup)
let observerInitialized = false;

export function initThemeObserver() {
	if (observerInitialized || typeof document === "undefined") return;
	observerInitialized = true;

	const observer = new MutationObserver(() => {
		const isDark = document.documentElement.classList.contains("dark");
		if (appStore.state.isDarkMode !== isDark) {
			appStore.setState((state) => ({ ...state, isDarkMode: isDark }));
		}
	});

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
}
