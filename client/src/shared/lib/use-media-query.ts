import { useEffect, useState } from "react";

/** Подписка на `matchMedia`; на SSR — `false` до гидрации. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => {
      setMatches(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, [query]);

  return matches;
}
