"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const PLAIN_WORDS = ["Qual", "sonho", "você", "quer"];
const GOLD_WORD = "realizar?";

export function HeroTitleAnimated() {
  // Only animate after hydration to avoid SSR opacity:0 issue
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shouldAnimate = mounted && !prefersReduced;

  return (
    <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl xl:text-[4.5rem]">
      {PLAIN_WORDS.map((word, i) => (
        <motion.span
          key={word}
          className="mr-[0.28em] inline-block"
          initial={shouldAnimate ? { opacity: 0, y: 28 } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
      <motion.span
        className="inline-block bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent"
        initial={shouldAnimate ? { opacity: 0, y: 28 } : false}
        animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
        transition={{
          duration: 0.6,
          delay: PLAIN_WORDS.length * 0.12,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {GOLD_WORD}
      </motion.span>
    </h1>
  );
}
