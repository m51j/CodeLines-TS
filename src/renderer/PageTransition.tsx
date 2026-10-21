import { useLayoutEffect, useRef, type ReactNode } from "react";

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

    const element = content.current,
      reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || reducedMotion.matches) return;

    const animation = element.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    const cancelForReducedMotion = () => {
      if (reducedMotion.matches) animation.cancel();
    };
    reducedMotion.addEventListener("change", cancelForReducedMotion);
    return () => {
      animation.cancel();
      reducedMotion.removeEventListener("change", cancelForReducedMotion);
    };
  }, [page]);

  return (
    <main>
      <div ref={content} className="page-content">
        {children}
      </div>
    </main>
  );
}
