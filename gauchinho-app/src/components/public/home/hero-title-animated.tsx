"use client";

import { motion, useReducedMotion } from "framer-motion";

const PLAIN_WORDS = ["Qual", "sonho", "você", "quer"];
const GOLD_WORD = "realizar?";

export function HeroTitleAnimated() {
  const shouldReduce = useReducedMotion();

  return (
    <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-[3.4rem]">
      {PLAIN_WORDS.map((word, i) => (
        <motion.span
          key={word}
          className="mr-[0.28em] inline-block"
          initial={shouldReduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
      <motion.span
        className="inline-block bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent"
        initial={shouldReduce ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.55,
          delay: PLAIN_WORDS.length * 0.12,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {GOLD_WORD}
      </motion.span>
    </h1>
  );
}
