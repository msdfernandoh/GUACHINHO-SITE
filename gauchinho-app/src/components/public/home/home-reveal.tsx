"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

type Props = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
};

export function HomeReveal({ children, className, delayMs = 0 }: Props) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={shouldReduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.65,
        ease: [0.25, 0.1, 0.25, 1],
        delay: delayMs / 1000,
      }}
    >
      {children}
    </motion.div>
  );
}
