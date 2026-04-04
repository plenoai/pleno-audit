/**
 * Lightweight motion wrapper for Preact using motion/mini (~2.5KB).
 *
 * Provides a declarative API similar to framer-motion's <motion.div>:
 *   <Motion tag="div" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} />
 *   <Motion tag="div" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} />
 *
 * Respects the user's animation preference stored in chrome.storage.local.
 * When disabled, elements render in their final state without animation.
 */
import { animate } from "motion/mini";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

type MotionStyle = Record<string, string | number>;

interface ViewportOptions {
	once?: boolean;
	margin?: string;
	threshold?: number;
}

interface TransitionOptions {
	duration?: number;
	delay?: number;
	ease?: string | number[];
}

type MotionProps<T extends keyof JSX.IntrinsicElements> = {
	tag?: T;
	initial?: MotionStyle;
	animate?: MotionStyle;
	whileInView?: MotionStyle;
	viewport?: ViewportOptions;
	transition?: TransitionOptions;
	children?: preact.ComponentChildren;
} & Omit<JSX.IntrinsicElements[T], "ref">;

// --- Animation settings context ---

const AnimationContext = createContext(true);

export const AnimationProvider = AnimationContext.Provider;

export function useAnimationEnabled() {
	return useContext(AnimationContext);
}

export function useAnimationSettings() {
	const [enabled, setEnabled] = useState(true);

	useEffect(() => {
		chrome.storage.local.get(["animationEnabled"]).then((result) => {
			if (result.animationEnabled === false) {
				setEnabled(false);
			}
		});
	}, []);

	const setAnimationEnabled = (value: boolean) => {
		setEnabled(value);
		chrome.storage.local.set({ animationEnabled: value });
	};

	return { animationEnabled: enabled, setAnimationEnabled };
}

// --- Helpers ---

/** Map shorthand properties (y, x) to CSS transforms */
function splitTransforms(style: MotionStyle): {
	css: Record<string, string | number>;
	x?: number;
	y?: number;
} {
	const css: Record<string, string | number> = {};
	let x: number | undefined;
	let y: number | undefined;

	for (const [k, v] of Object.entries(style)) {
		if (k === "y") y = v as number;
		else if (k === "x") x = v as number;
		else css[k] = v;
	}
	return { css, x, y };
}

function applyStyles(
	el: HTMLElement,
	style: MotionStyle,
) {
	const { css, x, y } = splitTransforms(style);
	for (const [k, v] of Object.entries(css)) {
		el.style.setProperty(k, String(v));
	}
	if (x !== undefined || y !== undefined) {
		el.style.transform = `translate(${x ?? 0}px, ${y ?? 0}px)`;
	}
}

function buildAnimateArgs(
	from: MotionStyle,
	to: MotionStyle,
): Record<string, [string | number, string | number]> {
	const result: Record<string, [string | number, string | number]> = {};
	const fromT = splitTransforms(from);
	const toT = splitTransforms(to);

	for (const key of Object.keys(toT.css)) {
		const fromVal = fromT.css[key] ?? toT.css[key];
		result[key] = [fromVal, toT.css[key]];
	}

	if (toT.x !== undefined || toT.y !== undefined) {
		const fx = fromT.x ?? 0;
		const fy = fromT.y ?? 0;
		const tx = toT.x ?? 0;
		const ty = toT.y ?? 0;
		result.transform = [
			`translate(${fx}px, ${fy}px)`,
			`translate(${tx}px, ${ty}px)`,
		];
	}

	return result;
}

// --- Motion component ---

export function Motion<T extends keyof JSX.IntrinsicElements = "div">({
	tag,
	initial,
	animate: animateTo,
	whileInView,
	viewport,
	transition,
	children,
	...rest
}: MotionProps<T>) {
	const ref = useRef<HTMLElement>(null);
	const Tag = (tag ?? "div") as string;
	const enabled = useAnimationEnabled();

	// When animation is disabled, apply final state immediately
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (!enabled) {
			const target = animateTo ?? whileInView;
			if (target) applyStyles(el, target);
			return;
		}
		if (initial) applyStyles(el, initial);
	}, []);

	// Animate on mount
	useEffect(() => {
		const el = ref.current;
		if (!el || !enabled || !initial || !animateTo) return;

		const keyframes = buildAnimateArgs(initial, animateTo);
		animate(el, keyframes, {
			duration: transition?.duration ?? 0.6,
			delay: transition?.delay,
			easing:
				typeof transition?.ease === "string"
					? transition.ease
					: transition?.ease
						? `cubic-bezier(${transition.ease.join(",")})`
						: "ease-out",
		});
	}, []);

	// Animate when in view
	useEffect(() => {
		const el = ref.current;
		if (!el || !whileInView) return;
		if (!enabled) return;

		if (initial) applyStyles(el, initial);

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;

				const keyframes = buildAnimateArgs(initial ?? {}, whileInView);
				animate(el, keyframes, {
					duration: transition?.duration ?? 0.6,
					delay: transition?.delay,
					easing:
						typeof transition?.ease === "string"
							? transition.ease
							: transition?.ease
								? `cubic-bezier(${transition.ease.join(",")})`
								: "ease-out",
				});

				if (viewport?.once) observer.disconnect();
			},
			{
				rootMargin: viewport?.margin ?? "0px",
				threshold: viewport?.threshold ?? 0,
			},
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		// @ts-expect-error -- dynamic tag
		<Tag ref={ref} {...rest}>
			{children}
		</Tag>
	);
}
