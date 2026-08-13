# Reference material

Original source material for the brand and design direction, kept verbatim.

**Do not edit anything in this folder.** These files are the record of what was
agreed. When the design system changes, change the design system and note it in
`docs/DESIGN-SYSTEM.md` - not here.

## Contents

| File                                             | What it is                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `Ceylon_Collection_Theme_Palette_Suggestion.pdf` | The agreed colour palette: core brand, public site theme, and admin dark/light                   |
| `public-website.html`                            | A hand-designed homepage, used as the reference for typography, colour pairings and overall feel |

## How these are used

`public-website.html` is a design reference, not code to be reused. What is taken
from it is the _decisions_ it encodes - the typeface pairing, the spacing rhythm,
how the palette is applied, the general restraint - which are then expressed as
design tokens and components in `src/`.

The palette from the PDF becomes three token sets in the codebase: `public`,
`admin-dark` (the default for the back office) and `admin-light`. Tokens are
defined in one place so the theme can be changed later without touching component
code.

Colour pairings taken from these files were checked for WCAG AA contrast before
being used for text. Where a brand colour did not pass against its intended
background, the token was adjusted for text use and the original kept for
decorative use. Those adjustments are recorded in `docs/DESIGN-SYSTEM.md`.
