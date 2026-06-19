import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Cinematic route transition. Re-keys children on pathname change so the
 * `motion-rise` keyframe replays. Pure CSS — respects `prefers-reduced-motion`.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={pathname} className="motion-rise will-change-[transform,opacity]">
      {children}
    </div>
  );
}
