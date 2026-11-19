import { useLayoutEffect, useRef, type ReactNode } from "react";
import { reducedMotion } from "./appearance/apply";

export function PageTransition({
  page,
  children,
}: {
  page: string;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null),
    previousPage = useRef(page);

  useLayoutEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;

    const element = content.current;
    if (!element || reducedMotion()) return;

    const animation = element.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    return () => animation.cancel();
  }, [page]);

  return (
    <main className={page === "Dashboard" ? "dashboard-page" : undefined}>
      <div ref={content} className="page-content">
        {children}
      </div>
    </main>
  );
}
