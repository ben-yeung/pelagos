"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;
const GLYPHS = "01<>/\\~=+*#:.";

/** Fades and lifts its children into place the first time they scroll in. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Headline whose words rise out of a mask, one after another. */
export function MaskedWords({
  text,
  delay = 0,
  inView = false,
  className,
}: {
  text: string;
  delay?: number;
  /** animate on scroll into view instead of on mount */
  inView?: boolean;
  className?: string;
}) {
  const words = text.split(" ");
  // Watch the outer span: the words themselves start clipped by their mask,
  // so an observer on them would never report them as visible.
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const shown = !inView || seen;
  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => {
        return (
          <span
            key={i}
            aria-hidden
            className="inline-block overflow-hidden pb-[0.12em] align-bottom"
          >
            <motion.span
              className="inline-block"
              initial={{ y: "115%" }}
              animate={{ y: shown ? "0%" : "115%" }}
              transition={{ duration: 0.95, delay: delay + i * 0.07, ease: EASE }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

/** Mono label that decodes from ASCII noise into its final text. */
export function Scramble({
  text,
  delay = 0,
  className,
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const [out, setOut] = useState<string | null>(null);

  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setOut(text), 0);
      return () => window.clearTimeout(id);
    }
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const duration = 500 + text.length * 22;
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration));
      const solved = Math.floor(p * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        if (i < solved || text[i] === " ") s += text[i];
        else if (now < start) s += " ";
        else s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, text, delay]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden className="whitespace-pre" style={{ opacity: out === null ? 0 : 1 }}>
        {out ?? text}
      </span>
    </span>
  );
}

/** Number that counts up from zero when it scrolls into view. */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const format = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + suffix;

  useEffect(() => {
    if (!seen || !ref.current) return;
    const node = ref.current;
    const controls = animate(0, value, {
      duration: 1.8,
      ease: EASE,
      onUpdate: (n) => {
        node.textContent = format(n);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(0)}
    </span>
  );
}

const SPECIES = [
  ["ECHO", "Megaptera novaeangliae", "song unit 14B"],
  ["ECHO", "Physeter macrocephalus", "coda 5R1"],
  ["REEF", "Acropora millepora", "bleaching 0.12"],
  ["STRAND", "Thunnus albacares", "eDNA 412 reads"],
  ["ECHO", "Tursiops truncatus", "signature whistle"],
  ["REEF", "Chelonia mydas", "re-sighting #2291"],
  ["STRAND", "Carcharhinus limbatus", "eDNA 88 reads"],
  ["ECHO", "Balaenoptera musculus", "D-call"],
  ["REEF", "Pocillopora damicornis", "recruit count 37"],
  ["ECHO", "Orcinus orca", "pulsed call S01"],
] as const;

type LogLine = { id: number; time: string; model: string; species: string; note: string; conf: string };

/** Fake live detection feed, styled as a terminal. */
export function DetectionLog() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { margin: "0px 0px -10% 0px" });
  const [lines, setLines] = useState<LogLine[]>([]);
  // survives the feed pausing and resuming, so keys never repeat
  const nextId = useRef(0);

  useEffect(() => {
    if (!seen) return;
    const add = () => {
      const [model, species, note] = SPECIES[Math.floor(Math.random() * SPECIES.length)];
      const d = new Date();
      const time = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
        .map((n) => String(n).padStart(2, "0"))
        .join(":");
      const conf = (0.82 + Math.random() * 0.17).toFixed(2);
      setLines((prev) => [...prev.slice(-6), { id: nextId.current++, time, model, species, note, conf }]);
    };
    add();
    const timer = window.setInterval(add, 1400);
    return () => window.clearInterval(timer);
  }, [seen]);

  return (
    <div
      ref={ref}
      className="border border-white bg-ocean font-mono text-[11px] leading-6 sm:text-xs sm:leading-7"
    >
      <div className="flex items-center justify-between border-b border-white px-4 py-2 uppercase tracking-widest">
        <span>pelagos://array-07/live</span>
        <span className="flex items-center gap-2">
          <motion.span
            className="inline-block size-2 bg-white"
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          rec
        </span>
      </div>
      <div className="flex h-56 flex-col justify-end overflow-hidden px-4 py-3">
        {lines.map((l) => (
          <motion.div
            key={l.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex gap-3 whitespace-nowrap"
          >
            <span className="opacity-60">{l.time}</span>
            <span className="w-14 shrink-0">{l.model}</span>
            <span className="min-w-0 flex-1 truncate italic">{l.species}</span>
            <span className="hidden opacity-60 md:inline">{l.note}</span>
            <span>p={l.conf}</span>
          </motion.div>
        ))}
        <div>
          &gt; <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}>_</motion.span>
        </div>
      </div>
    </div>
  );
}
