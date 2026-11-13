# Pelagos

Marketing site for **Pelagos**, a fictional AI startup building machine intelligence for marine biology. It's a single page set over a live, monochrome ASCII ocean.

## Highlights

- **ASCII ocean backdrop.** A full-screen canvas of drifting wave texture. The white sunlit zone gives way to blue at a dithered shoreline as you scroll down, with a depth gauge from the sunlight zone to the hadal zone.
- **Top-down sea life.** Fish, turtles, sharks, mantas, jellyfish, octopus, whales and shoals, drawn as digit-filled silhouettes that steer, bank and bend as they swim.
- **Reacts to you.** Scrolling speeds up the current and startles the creatures. Moving the cursor stirs ripples that bend the texture before the water settles back.
- **Readable by design.** The backdrop clears behind copy and the nav, so text never fights the animation.
- **Platform section.** A sticky instrument panel with live ASCII readouts: a whale-call spectrogram, a reef-mapping scan and eDNA reads being assigned to species.
- **Oversized wordmark.** PELAGOS is set in the wave texture at the bottom of the page, bleeding off the screen edges.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · [Motion](https://motion.dev)

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Where things live

| Path | What |
| --- | --- |
| `components/AsciiOcean.tsx` | Canvas backdrop: wave field, creatures, ripples, wordmark rendering |
| `lib/creatures.ts` | Creature shapes and swimming behaviour |
| `lib/readouts.ts` | Live ASCII readouts for the platform section |
| `lib/wordmark.ts` | Rasterises the PELAGOS wordmark onto the backdrop grid |
| `components/Platform.tsx`, `Nav.tsx`, `Hero.tsx` | Page sections |
| `app/page.tsx` | Page content and layout |

Visitors who turn on reduced motion get a calmer backdrop with no cursor ripples.

> All company details, figures and quotes are placeholder content.
