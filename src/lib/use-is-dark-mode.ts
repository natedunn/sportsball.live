import { useStore } from "@tanstack/react-store";
import { appStore } from "./store";

export function useIsDarkMode() {
	return useStore(appStore, (state) => state.isDarkMode);
}
