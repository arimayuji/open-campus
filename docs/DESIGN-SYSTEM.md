# Grove, the Open Campus design system

Live reference: `/ds/` (tokens read from the page, components working, motion you can replay).

## Idea
A lesson is a branch you grow. Each episode you finish draws the line to the next; coming back makes it thicker. Everything follows from that.

## Files
- `prototype/ds/tokens.css`: colour (light and dark), type, space, radius, motion tokens.
- `prototype/ds/base.css`: resets and the rules every page shares.
- `prototype/ds/components.css`: chip, button, key, meter, tile, plain words, arch, leaf and vine, answer option, citation, palette, brand.
- `prototype/ds/motion.css`: keyframes. Only opacity, transform and stroke move.
- `prototype/ds/ds.js`: `Grove.spotlight`, `Grove.morph`, `Grove.leaf`.
- `prototype/ds/ds.css`: the entry point a page imports.

## Rules
- Coral marks growth and the logo node. Never a button fill, never a second accent.
- Light surfaces are for reading, deep conifer is for watching and navigating.
- Pills are controls, the arch frames video, surfaces use the 18px radius.
- A wrong answer is dashed, not red.
- Three durations (120, 220, 420 ms), three easings. No animation of width, height, top or left. Reduced motion turns it all off.
- Every colour and font goes through a token.

## Using it
`@import url("../ds/ds.css");` in the page stylesheet, `<script src="../ds/ds.js">` for the behaviours, then compose with the class names shown in `/ds/`.
