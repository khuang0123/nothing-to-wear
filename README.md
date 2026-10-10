# nothing to wear

A mobile-first styling app built on one premise: **you own more outfits than you think.**
It remembers what is in your closet, styles it against your own taste rather than a
catalogue's, and only recommends buying something when the closet genuinely cannot do
the job — second-hand first.

This is an MVP. It runs entirely in the browser with no backend, no accounts and no
image uploads: demographics, biometrics and closet photos stay in `localStorage` on the
device, which is the right default for the data the app asks for.

**Requires Node `^20.19 || >=22.12`** (Vite 8 enforces it). On anything older the build
tool dies with `does not provide an export named 'styleText'`, which looks like a broken
project but is just a stale runtime — `npm install` and `npm run dev` both refuse early
with instructions instead. There is a `.nvmrc`, so `nvm use` picks the right one.

```bash
nvm use            # or: nvm install 22
npm install
npm run dev        # http://localhost:5173
npm test           # 111 unit tests over the styling engine and renderer
npm run build      # typecheck + production bundle
```

> On macOS with conda active, `which node` may point into `anaconda3/` and shadow nvm's
> Node. Either `conda deactivate` first, or `conda install -c conda-forge nodejs=22`.

On the first screen there is a **Load sample closet** button — 16 tagged pieces and a
sample profile, so the styling engine is explorable without photographing anything.

## The flow

| Stage | Screen | What happens |
| --- | --- | --- |
| Acquisition | `screens/Onboarding.tsx` | Account, demographics, coverage preference, geography, biometrics. Four steps, everything optional except coverage. |
| Activation | `screens/Home.tsx` | Demo reel, the four preference dimensions, and three *style directions* generated from the brief before you have uploaded anything. |
| Activation | `screens/Capture.tsx` | Hold pieces up to the camera one at a time, like showing a friend on a video call. Colours are read off each frame; the garment type pre-fills everything else. |
| Activation | `screens/Style.tsx` | Mix-and-match results as a grid of **drawn looks**. Tap one for the full view: palette, piece chips, numbered how-to-wear moves, accessory ideas. Choose a generated fit or snap your own OOTD, then confirm whether to store it. |
| Engagement | `screens/Closet.tsx` | The landing screen on every return visit. Saved fits as a grid of drawn looks, and every piece drawn on its own, each labelled *Yours* / *We guessed* / *AI idea*. |
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

## Every recommendation is a picture

A styling app that describes an outfit in prose has not recommended anything. So
each look is **drawn**: `lib/silhouette.ts` holds SVG path geometry for ~29 garment
silhouettes on a shared figure, and `components/LookFigure.tsx` composes them —
every piece in its real shape, real colour, and the position it is actually worn in.

- **Your own fabric, where you have it.** If a piece was photographed, the photo is
  clipped into that garment's path, so the look is built from your actual clothes
  rather than flat swatches.
- **Fit changes the drawing.** `fitted` through `oversized` scales the silhouette, so
  a relaxed wide-leg trouser looks different from a tailored one.
- **Patterns render.** Stripe, check, floral, animal, graphic and abstract are SVG
  pattern fills built from the garment's own two colours, readable at thumbnail size.
- **Role swaps are visible, not described.** A midi skirt worn as a top is drawn as a
  strapless band on the torso; a slip dress worn as a top becomes a tank; a shirt worn
  as outerwear becomes an open jacket (`shapeForRole`). A ⇄ marker flags it.
- **Layering reads.** When two pieces share a role, the outer one is drawn open — otherwise
  the second garment would simply paint over the first and the look would appear to be
  missing a piece.
- **Single pieces zoom.** In the closet, a t-shirt thumbnail crops to the torso rather
  than showing a full mannequin wearing a small t-shirt (`focusViewBox`).

Text is deliberately thin and secondary: a three-to-five word headline, piece chips,
and at most three numbered one-line styling moves. The reasoning and the score
breakdown are folded behind **Why** and **Scores**. Copy length is enforced by test.

## How the stylist works

`lib/stylist.ts`

Outfits are built from **skeletons** — slot lists rather than hardcoded pairs. A slot can
require a *role swap*, which is how "skirt worn as a tube top" or "dress over trousers"
become first-class outcomes with real instructions attached, gated behind the personality
dial. Every candidate is reduced to the same axes the vibe parser emits (formality, boldness,
skin, structure, saturation, contrast, texture, polish) and scored on six weighted
components: context fit, climate fit, colour, vibe, silhouette and daring. Results are
de-duplicated, and previously suggested outfits are penalised so shuffling gives you
something new.

Rationale is generated from the scores that actually won, which keeps it specific — and when
the closet cannot reach the requested vibe, the copy says so instead of claiming a match.

Results are diversified on **what you can see**, not just item overlap: four looks can share
no garments and still be the same outfit visually. The first selection pass requires a distinct
visual signature (skeleton plus the silhouette drawn in each role), and captions are
de-duplicated too, since a repeated headline makes distinct looks read as copies.

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
- **The figure is a neutral mannequin, not you.** Looks are drawn on a generic body at fixed
  proportions; height and body shape feed the *advice*, not the drawing. Rendering the user's
  own proportions is the obvious next step. Nothing is presented as a photo that isn't one.
- **The demo reel is an animated CSS sequence,** not video footage. Swap a real `<video>` into
  `components/ui.tsx` when there is any.
- **The vibe lexicon is hand-tuned, not a language model.** `parseVibe` is the seam an
  LLM-backed parser would implement; `StylistEngine` is the same seam for the generator, so a
  hosted model can be dropped in without touching the screens.
- **Sustainability numbers are rough industry averages,** labelled as such in the UI.
