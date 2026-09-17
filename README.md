# nothing to wear

A mobile-first styling app built on one premise: **you own more outfits than you think.**
It remembers what is in your closet, styles it against your own taste rather than a
catalogue's, and only recommends buying something when the closet genuinely cannot do
the job — second-hand first.

This is an MVP. It runs entirely in the browser with no backend, no accounts and no
image uploads: demographics, biometrics and closet photos stay in `localStorage` on the
device, which is the right default for the data the app asks for.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 91 unit tests over the styling engine
npm run build      # typecheck + production bundle
```

On the first screen there is a **Load sample closet** button — 16 tagged pieces and a
sample profile, so the styling engine is explorable without photographing anything.

## The flow

| Stage | Screen | What happens |
| --- | --- | --- |
| Acquisition | `screens/Onboarding.tsx` | Account, demographics, coverage preference, geography, biometrics. Four steps, everything optional except coverage. |
| Activation | `screens/Home.tsx` | Demo reel, the four preference dimensions, and three *style directions* generated from the brief before you have uploaded anything. |
| Activation | `screens/Capture.tsx` | Hold pieces up to the camera one at a time, like showing a friend on a video call. Colours are read off each frame; the garment type pre-fills everything else. |
| Activation | `screens/Style.tsx` | Mix-and-match results with palette, accessory ideas, how-to-wear moves and guardrail nudges. Choose a generated fit or snap your own OOTD, then confirm whether to store it. |
| Engagement | `screens/Closet.tsx` | The landing screen on every return visit. Saved fits and pieces, each labelled *Your photo* / *We guessed* / *AI styled*. |
| Engagement | `screens/Shop.tsx` | Stays empty unless the closet analysis says you are genuinely short. |
| Referral | `screens/Friends.tsx` | Add friends by phone, one visibility switch, share to the OS share sheet. |

## The four preference dimensions

1. **Context** — event / workday / date / normal day / just shuffling. The free-text note
   matters more than the button: `black tie gala`, `funeral`, `interview` and `mosque` each
   change the dress code the app holds you to (`lib/context.ts`).
2. **Personality dial** — 0 is conservative, 100 is avant-garde. This *re-weights the scoring
   function*, it does not add randomness. At the low end, body-shape proportion rules and
   colour harmony dominate. At the high end, flattery is largely ignored, colour clashes score
   *higher* than resolved palettes, and unconventional structures unlock.
3. **Vibe** — free text, parsed into numeric axes by a local semantic lexicon
   (`lib/lexicon.ts`). Terms blend rather than the last one winning, so *"sexy but smart"*
   lands between the two. Negation mirrors across neutral (*"not sexy"* means covered, not
   "no opinion"), and intensifiers/softeners are weighted. Words it cannot map are shown
   back to the user rather than silently ignored.
4. **Guardrails** — coverage, dress code, weather and comfort checks that *nudge and offer a
   swap*, never block. Every nudge has a "Wear it anyway".

## How the stylist works

`lib/stylist.ts`

Outfits are built from **skeletons** — slot lists rather than hardcoded pairs. A slot can
require a *role swap*, which is how "skirt worn as a tube top" or "dress over trousers"
become first-class outcomes with real instructions attached, gated behind the personality
dial. Every candidate is reduced to the same axes the vibe parser emits (formality, boldness,
skin, structure, saturation, contrast, texture, polish) and scored on six weighted
components: context fit, climate fit, colour, vibe, silhouette and daring. Results are
de-duplicated so no two suggestions share more than half their pieces, and previously
suggested outfits are penalised so shuffling gives you something new.

Rationale is generated from the scores that actually won, which keeps it specific — and when
the closet cannot reach the requested vibe, the copy says so instead of claiming a match.

`lib/color.ts` does the colour maths from scratch: HSL conversion, neutral detection (including
the beige family that behaves like a neutral), relationship naming, and the accent a stylist
would reach for, which moves further from the base colour as the dial goes up.

`lib/imageColors.ts` extracts garment colours in-browser with centre-weighted k-means over a
downsampled canvas. Deterministic farthest-point seeding, so the same photo always tags the
same way and two colours with equal channel sums (red vs blue) don't collapse into one cluster.

## When it tells you to buy something

`lib/wardrobe.ts` is **marginal-gain based**. For every candidate garment it recomputes how
many wearable outfits the closet would support with that piece added, and ranks by the
difference. A piece that unlocks nothing is never recommended, however fashionable. The
verdict comes from three signals — outfit capacity, coverage of the slot × formality matrix,
and raw piece count — and only `not-enough` opens the shopping screen. Sources are listed
second-hand first, with "search new" visually de-emphasised as the last resort.

The same module predicts staples you probably own but have not photographed (a plain tee,
jeans, a coat if your climate needs one) with a reason for each guess. Predicted pieces are
labelled **We guessed** and are excluded from styling until you confirm them.

## Known limits of this MVP

- **No backend.** Friends, invites and shared closets are local only — adding a friend sends
  nothing to that number. This is the obvious next piece of work.
- **No generated imagery.** "Picturing the user wearing it" is shown as a flat-lay board of the
  actual pieces plus a palette, not a rendered image of the user. Nothing is presented as a
  photo that isn't one.
- **The demo reel is an animated CSS sequence,** not video footage. Swap a real `<video>` into
  `components/ui.tsx` when there is any.
- **The vibe lexicon is hand-tuned, not a language model.** `parseVibe` is the seam an
  LLM-backed parser would implement; `StylistEngine` is the same seam for the generator, so a
  hosted model can be dropped in without touching the screens.
- **Sustainability numbers are rough industry averages,** labelled as such in the UI.
