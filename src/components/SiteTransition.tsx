import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

export function SiteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 40);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.search]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${location.pathname}${location.search}`}
        className="arka-route-shell"
        initial={{ clipPath: "inset(0 0 100% 0 round 0px)" }}
        animate={{ clipPath: "inset(0 0 0% 0 round 0px)", opacity: ready ? 1 : 0.98 }}
        exit={{ clipPath: "inset(0 0 100% 0 round 0px)", opacity: 0 }}
        transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
