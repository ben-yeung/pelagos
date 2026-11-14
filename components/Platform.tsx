"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { echoReadout, reefReadout, strandReadout } from "@/lib/readouts";
import { MaskedWords, Scramble } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;

type Product = {
  code: string;
  uri: string;
  kicker: string;
  title: string;
  body: string;
  metrics: [string, string][];
  points: string[];
  readout: () => (seconds: number) => string;
};

const PRODUCTS: Product[] = [
  {
    code: "ECHO",
    uri: "pelagos://echo/array-07",
    kicker: "Passive acoustics",
    title: "Whale calls, isolated from the noise.",
    body: "A self-supervised audio model, distilled to 12M parameters to run on the mooring.",
    metrics: [
      ["0.94", "mAP, 212 call types"],
      ["9 ms", "latency per 1 s frame"],
      ["0.6 W", "inference power"],
    ],
    points: ["Source separation through vessel noise", "Few-shot: new call types from 20 labels"],
    readout: echoReadout,
  },
  {
    code: "REEFSIGHT",
    uri: "pelagos://reefsight/transect-3",
    kicker: "Benthic vision",
    title: "Reef surveys, segmented pixel by pixel.",
    body: "Maps coral cover, bleaching and new growth from diver and ROV footage.",
    metrics: [
      ["0.87", "mIoU, 46 classes"],
      ["0.4 cm", "ground sample distance"],
      ["1,900", "taxa"],
    ],
    points: ["Bleaching flagged below 5% pigment loss", "Colony re-ID across surveys, ±2 cm"],
    readout: reefReadout,
  },
  {
    code: "STRAND",
    uri: "pelagos://strand/sample-0412",
    kicker: "eDNA metabarcoding",
    title: "What passed by, read from a litre of seawater.",
    body: "The same moorings filter water daily. Shed DNA is sequenced on board and matched against a reference library of 41,000 marine species.",
    metrics: [
      ["94.6%", "species recall, 12S + COI"],
      ["24–48 h", "window a DNA trace covers"],
      ["6 h", "filter to report, at sea"],
    ],
    points: [
      "Detections cross-checked against what Echo heard and Reefsight saw",
      "Unknown reads flagged as candidate new taxa",
    ],
    readout: strandReadout,
  },
];

/** A <pre> driven by a readout factory, written directly without re-rendering. */
function Readout({ make }: { make: Product["readout"] }) {
  const ref = useRef<HTMLPreElement>(null);
  const visible = useInView(ref, { margin: "120px" });
  const [frame] = useState(make);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || !visible) {
      if (!node.textContent) node.textContent = frame(4);
      return;
    }
    let raf = 0;
    let last = 0;
    const start = performance.now() - 4000;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 24) return;
      last = now;
      node.textContent = frame((now - start) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [frame, visible]);

  return (
    <pre
      ref={ref}
      aria-hidden
      className="overflow-hidden font-mono text-[9px] leading-[1.45] sm:text-[11px] xl:text-[12.5px]"
    />
  );
}

/** Instrument panel: tabs, live readout, status line. */
function Panel({ active, onSelect }: { active: number; onSelect?: (i: number) => void }) {
  const p = PRODUCTS[active];
  return (
    <div className="border border-white bg-ocean text-white">
      <div className="flex border-b border-white font-mono text-[10px] uppercase tracking-widest sm:text-xs">
        {PRODUCTS.map((q, i) => (
          <button
            key={q.code}
            type="button"
            onClick={() => onSelect?.(i)}
            disabled={!onSelect}
            aria-pressed={i === active}
            className={`relative flex-1 border-r border-white px-3 py-3 text-left last:border-r-0 sm:px-4 ${onSelect ? "cursor-pointer" : "cursor-default"}`}
          >
            {i === active && (
              <motion.span
                layoutId={onSelect ? "panel-tab" : undefined}
                className="absolute inset-0 bg-white"
                transition={{ duration: 0.5, ease: EASE }}
              />
            )}
            <span className={`relative ${i === active ? "text-ocean" : ""}`}>
              0{i + 1} {q.code}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 pt-3 font-mono text-[10px] uppercase tracking-widest opacity-70 sm:text-xs">
        <span>{p.uri}</span>
        <span className="flex items-center gap-2">
          <motion.span
            className="inline-block size-1.5 bg-white"
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
          live
        </span>
      </div>
      <div className="relative px-4 pb-4 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={p.code}
            initial={{ opacity: 0, filter: "blur(6px)", y: 8 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(6px)", y: -8 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Readout make={p.readout} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** One chapter of copy; reports when it reaches the middle of the screen. */
function Chapter({
  product,
  index,
  active,
  onActive,
}: {
  product: Product;
  index: number;
  active: boolean;
  onActive: (i: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const centred = useInView(ref, { margin: "-48% 0px -48% 0px" });
  useEffect(() => {
    if (centred) onActive(index);
  }, [centred, index, onActive]);

  return (
    <article
      ref={ref}
      id={`product-${product.code.toLowerCase()}`}
      className="flex scroll-mt-24 flex-col justify-center py-16 lg:min-h-[78vh] lg:py-0"
    >
      {/* the spotlight only makes sense beside the sticky panel, so desktop only */}
      <div
        className={`transition-opacity duration-700 ease-out ${active ? "opacity-100" : "lg:opacity-30"}`}
      >
        <div className="flex items-end gap-6">
          <span className="text-[clamp(5rem,11vw,9rem)] font-medium leading-[0.8] tracking-[-0.06em]">
            0{index + 1}
          </span>
          <span className="mb-1 font-mono text-[13px] font-semibold uppercase leading-relaxed tracking-[0.22em]">
            {product.code}
            <br />
            <span className="opacity-80">{product.kicker}</span>
          </span>
        </div>
        <h3 className="mt-10 max-w-xl text-[clamp(1.75rem,3vw,2.6rem)] font-medium leading-[1.08] tracking-[-0.03em]">
          {product.title}
        </h3>
        <p className="mt-6 max-w-xl text-lg leading-relaxed">{product.body}</p>

        <dl className="mt-10 grid max-w-xl grid-cols-3 border-y border-white">
          {product.metrics.map(([value, label], i) => (
            <div key={label} className={`py-5 ${i > 0 ? "border-l border-white pl-4" : ""}`}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-medium tracking-[-0.02em] sm:text-3xl">{value}</dd>
              <dd className="mt-2 text-sm font-medium leading-snug sm:text-[15px]">{label}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-8 max-w-xl space-y-3 text-base leading-relaxed sm:text-[17px]">
          {product.points.map((point) => (
            <li key={point} className="flex items-baseline gap-3">
              <span aria-hidden className="inline-block size-1.5 shrink-0 -translate-y-[0.3em] bg-current" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* small screens: each chapter carries its own instrument */}
      <div className="mt-12 lg:hidden">
        <Panel active={index} />
      </div>
    </article>
  );
}

export default function Platform() {
  const [active, setActive] = useState(0);

  const select = (i: number) => {
    document
      .getElementById(`product-${PRODUCTS[i].code.toLowerCase()}`)
      ?.scrollIntoView({ block: "center" });
  };

  return (
    <section id="platform" className="scroll-mt-16 px-6 py-32 sm:px-10 lg:px-16">
      <p className="mb-8 font-mono text-[13px] font-semibold uppercase tracking-[0.22em]">
        <Scramble text="[ 003 ]  The platform" />
      </p>
      <div className="grid items-end gap-8 lg:grid-cols-[1.4fr_1fr]">
        <h2 className="text-[clamp(2rem,4.6vw,4rem)] font-medium leading-[1.04] tracking-[-0.035em]">
          <MaskedWords inView text="Three models. One picture of what lives down there." />
        </h2>
        <p className="max-w-md text-lg leading-relaxed lg:justify-self-end">
          Sound, sight and DNA, mapped into one shared species embedding.
        </p>
      </div>

      <div className="mt-16 grid gap-16 lg:mt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-20">
        <div className="hidden lg:block">
          <div className="sticky top-[14vh] py-[6vh]">
            <Panel active={active} onSelect={select} />
            <div className="mt-6 flex gap-2" aria-hidden>
              {PRODUCTS.map((p, i) => (
                <motion.span
                  key={p.code}
                  className="h-px flex-1 origin-left bg-white"
                  animate={{ scaleX: i <= active ? 1 : 0.15, opacity: i <= active ? 1 : 0.4 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              ))}
            </div>
          </div>
        </div>
        <div>
          {PRODUCTS.map((p, i) => (
            <Chapter key={p.code} product={p} index={i} active={i === active} onActive={setActive} />
          ))}
        </div>
      </div>
    </section>
  );
}
