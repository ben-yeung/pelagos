"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { MaskedWords, Scramble } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // The copy sinks and fades as the page dives under the shoreline.
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const opacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  return (
    <section
      id="hero"
      ref={ref}
      className="relative flex min-h-svh flex-col px-6 pb-56 pt-[4.5rem] sm:px-10 lg:px-16"
    >
      <motion.div className="mt-auto max-w-5xl pt-[34svh]" style={{ y, opacity }}>
        <p className="mb-6 font-mono text-[13px] font-semibold uppercase tracking-[0.22em]">
          <Scramble text="[ 001 ]  Marine intelligence lab" delay={0.5} />
        </p>
        <h1 className="text-[clamp(2.6rem,8vw,7rem)] font-medium leading-[0.95] tracking-[-0.045em]">
          <MaskedWords text="Machine intelligence for the living ocean." delay={0.7} />
        </h1>
        <motion.p
          className="mt-8 max-w-xl text-lg leading-relaxed sm:text-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.45, ease: EASE }}
        >
          Foundation models for ocean audio, reef imagery and eDNA, running on
          sensors at sea.
        </motion.p>
        <motion.div
          className="mt-10 flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-widest"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.65, ease: EASE }}
        >
          <a
            href="#contact"
            className="border border-ocean bg-ocean px-6 py-4 text-white transition-colors hover:bg-white hover:text-ocean"
          >
            Request access
          </a>
          <a
            href="#platform"
            className="border border-ocean bg-white px-6 py-4 transition-colors hover:bg-ocean hover:text-white"
          >
            Explore the platform
          </a>
          <motion.span
            className="ml-2 hidden sm:inline"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            ↓ Scroll to dive
          </motion.span>
        </motion.div>
      </motion.div>
    </section>
  );
}
