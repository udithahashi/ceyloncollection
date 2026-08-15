# Brand assets

Where the public site's imagery came from, and how to make more that matches.

## The rule

Images for this project are generated with **Higgsfield**, and the owner's
instruction is explicit: **if a Higgsfield generation or login fails, stop and tell
him.** Do not substitute another tool, do not hand-roll a placeholder, do not ship
the page with a missing image and a note. He would rather troubleshoot Higgsfield
than discover later that half the site's art came from somewhere else.

Model choice follows the same instruction:

| Work                                     | Model             |
| ---------------------------------------- | ----------------- |
| Photographic, realistic, textile, people | `nano_banana_pro` |
| Icons, UI graphics, anything with text   | `gpt_image_2`     |

**The logo is not on this list.** The owner has hired a human designer for the
mark; `src/app/icon.tsx` is a coded placeholder favicon in the meantime, and
`BrandMark` is still type only. Do not generate logo marks - see
`docs/HANDOVER.md` §2 for the full story.

## Pipeline

1. Generate, writing the prompt to a file first so the shell never mangles it:

   ```bash
   higgsfield generate create nano_banana_pro \
     --aspect_ratio 4:5 --resolution 2k --wait --json \
     < reference/generated-raw/<name>.txt \
     > reference/generated-raw/<name>-result.json
   ```

2. Download the `result_url` into `reference/generated-raw/<name>.png`. On this
   machine `curl` needs `--ssl-no-revoke`, or it fails the CDN's certificate
   revocation check with a confusing `schannel` error.

3. Build the web assets:

   ```bash
   node scripts/build-brand-images.mjs
   ```

   Raw generations are 6-8 MB PNGs. That script resizes each to the size it is
   actually displayed at (doubled, for retina) and encodes WebP, which took the
   current set from ~35 MB to ~636 KB.

`reference/generated-raw/` is gitignored - raw files stay on the machine that made
them. `public/brand/` is committed and served. A fresh clone therefore has the web
assets but not the originals, which is why the prompts below are the real record.

## The prompts

Every one of these ran on `nano_banana_pro` at `--resolution 2k`. All five ask for
no text, no logos and no watermarks, because a generated word in an image cannot be
translated, corrected, or trusted to be spelled right.

The house style, common to all of them: soft directional daylight, muted editorial
colour grade built on the brand's ivory and navy with restrained gold, visible fabric
texture, generous negative space, calm and unhurried. A heritage textile house, not a
fast-fashion catalogue.

### `hero` - 4:5

> Editorial fashion photograph for a boutique clothing brand. A South Asian woman in
> her late twenties wearing an elegant handwoven Sri Lankan silk saree in deep navy
> with a gold thread border, standing in three-quarter profile in soft diffused
> daylight beside a cream plastered wall. Natural window light from the left, gentle
> falloff, calm dignified expression looking slightly away from camera. Shot on medium
> format, 85mm, shallow depth of field, muted warm colour grade with ivory and navy
> dominating and restrained gold accents. Fine fabric texture and drape clearly
> visible. Quiet, refined, unhurried mood - a heritage textile house, not a fast
> fashion catalogue. No text, no logos, no watermarks, no jewellery clutter.

### `loom` - 4:3

> Documentary photograph of a traditional Sri Lankan handloom in a hill country
> weaving workshop. Close three-quarter view of the wooden loom with warp threads
> stretched in navy and gold, a weaver's hands mid-motion passing the shuttle, face
> not visible. Soft natural light through an open shutter, dust motes in the air, worn
> timber and cotton thread texture. Warm muted colour grade, ivory and deep navy,
> restrained gold highlights. Respectful, documentary, unstaged. No text, no logos, no
> watermarks.

Faces are deliberately excluded here. An invented face attached to a claim about
real artisans would be a small lie in the middle of the page that is about honesty.

### `edit-saree` - 4:5

> Still life product photograph of a folded handwoven Sri Lankan silk saree in deep
> navy with a fine gold thread border, arranged on a pale cream linen surface.
> Overhead three-quarter angle, soft directional daylight raking across the fabric to
> reveal weave texture and sheen. Minimal composition, generous negative space, muted
> editorial colour grade in ivory and navy. Boutique heritage textile catalogue. No
> text, no logos, no watermarks, no hands, no people.

### `edit-occasion` - 4:5

> Still life product photograph of an elegant occasion-wear frock in dusty rose and
> blush fabric, softly draped over a pale cream surface with the skirt falling
> naturally. Soft directional daylight, gentle shadows, visible fabric texture and
> delicate embroidery detail at the neckline. Minimal composition, generous negative
> space, muted editorial colour grade in ivory, blush and rose. Boutique catalogue. No
> text, no logos, no watermarks, no hands, no people.

### `edit-everyday` - 4:5

> Still life product photograph of a stack of neatly folded lightweight cotton and
> batik fabrics in warm gold, ochre and cream tones, on a pale cream linen surface.
> Overhead three-quarter angle, soft directional daylight, visible hand-block batik
> print detail and cotton weave texture. Minimal composition, generous negative space,
> muted editorial colour grade. Boutique heritage textile catalogue. No text, no
> logos, no watermarks, no hands, no people.

## What these images are, and are not

They are **art direction, not inventory.** Nothing here is a photograph of stock the
business owns - there is no stock table yet, and no product catalogue. The site they
illustrate asks people what they are looking for; it does not offer them a specific
saree at a specific price.

That distinction is why the collection tiles are still lifes of fabric rather than
numbered products with prices, and it is worth preserving. The moment a generated
image sits next to a real price and a Buy button, it stops being art direction and
starts being a claim about a thing that does not exist.

## Still to make

- Empty-state illustrations for the back office (no leads, no results, no chart
  data) and 404/500 artwork. Not started, and worth asking the owner first whether
  these should wait for the same designer doing the logo.
- Category tiles for the wider taxonomy, if the public site ever grows a browse page.
