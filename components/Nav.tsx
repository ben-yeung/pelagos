"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

const LINKS = [
  ["Platform", "platform"],
  ["Method", "method"],
  ["Field notes", "field-notes"],
] as const;

/** Sections that can light up a link; ones without a link clear the marker. */
const TRACKED = ["problem", "platform", "method", "field-notes", "contact"];

/**
 * Site header. At the top of the page it is the full-width hero header; once
 * you scroll it condenses into a slim frosted bar centred at the top, and it
 * switches to white-on-blue once the page has dived below the shoreline.
 */
export default function Nav() {
  const [compact, setCompact] = useState(false);
  const [deep, setDeep] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const measure = () => {
      setCompact(window.scrollY > 48);
      setDeep(hero ? hero.getBoundingClientRect().bottom < 40 : false);
    };
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // the page may load already scrolled (reload, #anchor)
    const id = window.setTimeout(measure, 0);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      // a section counts as current while it crosses the middle of the screen
      { rootMargin: "-45% 0px -50% 0px" },
    );
    const sections = TRACKED.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    sections.forEach((s) => observer.observe(s));
    const hero = document.getElementById("hero");
    const clear = new IntersectionObserver(([e]) => e.isIntersecting && setActive(null), {
      rootMargin: "-45% 0px -50% 0px",
    });
    if (hero) clear.observe(hero);
    return () => {
      observer.disconnect();
      clear.disconnect();
    };
  }, []);

  const tone = deep
    ? "text-white bg-ocean/85 border-white/25"
    : "text-ocean bg-white/85 border-ocean/15";
  const cta = deep ? "bg-white text-ocean hover:bg-transparent hover:text-white" : "bg-ocean text-white hover:bg-transparent hover:text-ocean";

  return (
    <motion.header
      className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.5, ease: EASE }}
    >
      <motion.div
        layout
        data-veil="block"
        transition={{ layout: { duration: 0.6, ease: EASE } }}
        className={`pointer-events-auto flex items-center font-mono uppercase transition-colors duration-500 ${
          compact
            ? `mt-3 max-w-[calc(100%-1.5rem)] gap-5 border px-3 py-2 text-[10px] tracking-[0.18em] backdrop-blur-md sm:gap-7 sm:pl-4 ${tone}`
            : "w-full justify-between border border-transparent px-6 py-6 text-xs tracking-widest text-ocean sm:px-10 lg:px-16"
        }`}
      >
        <motion.a layout="position" href="#hero" className="flex items-center gap-3 font-semibold">
          <span aria-hidden>&gt;&lt;&gt;</span> Pelagos
        </motion.a>

        <motion.nav layout="position" className="hidden items-center gap-6 md:flex lg:gap-8">
          {LINKS.map(([label, id]) => {
            const on = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                aria-current={on ? "location" : undefined}
                className={`flex items-center gap-2 underline-offset-4 transition-opacity hover:underline ${
                  compact && !on ? "opacity-60 hover:opacity-100" : ""
                }`}
              >
                <motion.span
                  aria-hidden
                  className="inline-block size-1 bg-current"
                  animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                />
                {label}
              </a>
            );
          })}
        </motion.nav>

        <motion.a
          layout="position"
          href="#contact"
          className={`border border-current transition-colors ${
            compact ? `px-3 py-1.5 ${cta}` : "bg-white px-4 py-2 hover:bg-ocean hover:text-white"
          }`}
        >
          Request access
        </motion.a>
      </motion.div>
    </motion.header>
  );
}
