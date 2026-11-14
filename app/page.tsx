import AsciiOcean from "@/components/AsciiOcean";
import Hero from "@/components/Hero";
import Nav from "@/components/Nav";
import Platform from "@/components/Platform";
import { CountUp, DetectionLog, MaskedWords, Reveal, Scramble } from "@/components/ui";

const STATS = [
  { value: 2.4, decimals: 1, suffix: "M", label: "hydrophone hours, 96 kHz" },
  { value: 11800, decimals: 0, suffix: "", label: "taxa in one shared embedding" },
  { value: 38, decimals: 0, suffix: "", label: "edge deployments: moorings, gliders, AUVs" },
];

const STEPS = [
  {
    n: "01",
    title: "Ingest",
    lead: "Raw data, straight from the sensor.",
    points: [
      "Hydrophone audio, ROV video and DNA reads",
      "Every sample stamped to UTC and GPS",
      "Never downsampled or relabelled",
    ],
  },
  {
    n: "02",
    title: "Align",
    lead: "Three signals, one species.",
    points: [
      "A separate encoder for each modality",
      "Trained into one shared species embedding",
      "One strong signal confirms two weak ones",
    ],
  },
  {
    n: "03",
    title: "Forecast",
    lead: "Detections become decisions.",
    points: [
      "Occupancy, migration and heat-stress risk",
      "Updated daily, with calibrated uncertainty",
      "Delivered by API or weekly report",
    ],
  },
];

function SectionLabel({ index, children }: { index: string; children: string }) {
  return (
    <p className="mb-8 font-mono text-[13px] font-semibold uppercase tracking-[0.22em]">
      <Scramble text={`[ ${index} ]  ${children}`} />
    </p>
  );
}

export default function Home() {
  return (
    <>
      <AsciiOcean />
      <Nav />
      <main className="relative z-10">
        <Hero />

        <div className="deep text-white">
          {/* ── Manifesto ───────────────────────────────────────────── */}
          <section id="problem" className="px-6 pb-32 pt-48 sm:px-10 lg:px-16">
            <SectionLabel index="002">The problem</SectionLabel>
            <h2 className="max-w-6xl text-[clamp(2rem,5.4vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.035em]">
              <MaskedWords
                inView
                text="Petabytes of ocean data a year. Almost none of it is read."
              />
            </h2>
            <div className="mt-24 grid gap-px border border-white bg-white md:grid-cols-3">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={i * 0.12} className="bg-ocean p-8 lg:p-10">
                  <div className="text-6xl font-medium tracking-[-0.04em] lg:text-7xl">
                    <CountUp value={s.value} decimals={s.decimals} suffix={s.suffix} />
                  </div>
                  <p className="mt-6 max-w-[28ch] text-base font-medium leading-snug sm:text-lg">
                    {s.label}
                  </p>
                </Reveal>
              ))}
            </div>
          </section>

          <Platform />

          {/* ── Method ──────────────────────────────────────────────── */}
          <section id="method" className="scroll-mt-16 px-6 py-32 sm:px-10 lg:px-16">
            <SectionLabel index="004">The method</SectionLabel>
            <div className="border-t border-white">
              {STEPS.map((s) => (
                <Reveal key={s.n}>
                  <div className="grid gap-4 border-b border-white py-10 md:grid-cols-[8rem_1fr_1.4fr] md:gap-10 md:py-14">
                    <span className="font-mono text-sm font-semibold tracking-widest">{s.n}</span>
                    <h3 className="text-4xl font-medium tracking-[-0.03em] md:text-6xl">
                      {s.title}
                    </h3>
                    <div className="max-w-xl">
                      <p className="text-2xl font-medium leading-snug tracking-[-0.015em]">{s.lead}</p>
                      <ul className="mt-6 space-y-3 text-base leading-relaxed sm:text-[17px]">
                        {s.points.map((point) => (
                          <li key={point} className="flex items-baseline gap-3">
                            <span aria-hidden className="inline-block size-1.5 shrink-0 -translate-y-[0.3em] bg-current" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* ── Field notes ─────────────────────────────────────────── */}
          <section id="field-notes" className="scroll-mt-16 px-6 py-32 sm:px-10 lg:px-16">
            <SectionLabel index="005">Field notes</SectionLabel>
            <div className="grid items-end gap-14 lg:grid-cols-2">
              <Reveal>
                <blockquote className="text-[clamp(1.6rem,3vw,2.6rem)] font-medium leading-[1.15] tracking-[-0.025em]">
                  “Echo logged a blue whale D-call 40 km out, on the mooring,
                  before we had recovered the hardware.”
                </blockquote>
                <p className="mt-8 text-base font-medium">
                  — Chief scientist, North Atlantic PAM survey
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <DetectionLog />
              </Reveal>
            </div>
          </section>

          {/* ── Contact ─────────────────────────────────────────────── */}
          <section id="contact" className="scroll-mt-16 px-6 pb-24 pt-32 sm:px-10 lg:px-16">
            <SectionLabel index="006">Come aboard</SectionLabel>
            <h2 className="text-[clamp(3rem,11vw,10rem)] font-medium leading-[0.9] tracking-[-0.05em]">
              <MaskedWords inView text="Dive with us." />
            </h2>
            <Reveal className="mt-12 flex flex-wrap items-center gap-4 font-mono text-[13px] font-semibold uppercase tracking-widest">
              <a
                href="mailto:hello@pelagos.example"
                className="border border-white bg-white px-6 py-4 text-ocean transition-colors hover:bg-ocean hover:text-white"
              >
                Request access
              </a>
              <a
                href="mailto:research@pelagos.example"
                className="border border-white bg-ocean px-6 py-4 transition-colors hover:bg-white hover:text-ocean"
              >
                Partner a vessel
              </a>
            </Reveal>
          </section>

          <footer
            id="seabed"
            className="flex flex-col justify-start px-6 pb-[calc(13vw+3.25rem)] pt-10 font-mono text-[13px] font-semibold uppercase tracking-widest sm:px-10 lg:px-16"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white pt-6">
              <span>&gt;&lt;&gt; Pelagos Labs</span>
              <span>Built for the sea, 2026</span>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
