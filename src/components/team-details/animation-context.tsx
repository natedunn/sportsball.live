import {
	createContext,
	useContext,
	useEffect,
	useRef,
	type ReactNode,
} from "react";

const AnimationContext = createContext(false);

interface AnimationProviderProps {
	activeTab: string;
	children: ReactNode;
}

export function AnimationProvider({ activeTab, children }: AnimationProviderProps) {
	const animatedTabs = useRef(new Set<string>());

	// Computed synchronously during render so children see the correct value at mount
	const hasAnimated = animatedTabs.current.has(activeTab);

	// Mark this tab as animated after its first render
	useEffect(() => {
		animatedTabs.current.add(activeTab);
	}, [activeTab]);

	return (
		<AnimationContext.Provider value={hasAnimated}>
			{children}
		</AnimationContext.Provider>
	);
}

export function useHasTabAnimated() {
	return useContext(AnimationContext);
}
