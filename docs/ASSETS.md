# Brand assets

Where the public site's imagery came from, and how to make more that matches.

## August 2026 campaign (current public site)

A second shoot, after the homepage was cleared and rebuilt around අපේ කම.
Character anchors were generated from the existing Souls (Maya, Viana, Skyler)
plus a new male likeness (Arun), then passed as `--image` into
`nano_banana_pro` for the fashion frames. Promotional ground: `gpt_image_2`.

| Asset           | Character | Notes                                   |
| --------------- | --------- | --------------------------------------- |
| `hero`          | Maya      | Flower frock, plaster interior          |
| `flower-frocks` | Maya      | Collection + Nimali piece               |
| `galle-wax`     | Maya      | Batik frock                             |
| `batik-sarong`  | Arun      | Men’s sarong, worn rather than arranged |
| `womens-cotton` | Skyler    | Harbour tee                             |
| `mens-cotton`   | Arun      | Fort tee                                |
| `womens-office` | Viana     | Colombo set                             |
| `mens-office`   | Arun      | Pettah shirt                            |
| `offer-april`   | —         | GPT Image 2 campaign ground             |

Prompts live in `reference/generated-raw/<name>.txt`. The previous batik-led
set (`edit-*`, `look-*`, `craft-*`) is still on disk and used for journal/craft.

---

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
| Icons, UI graphics, poster artwork       | `gpt_image_2`     |

**Character shots go through `nano_banana_pro`, not a Soul model.** The workspace
has a trained Soul, "Maya Onelz"
(`162d4995-6ce8-42ca-803c-848f51768972`, type `soul_cinematic`), and the obvious
route is `soul_cinematic --custom_reference_id`. The owner's judgement after
comparing both: Soul Cinema is weaker at character than Nano Banana Pro. So Maya
is generated once through the Soul to establish her likeness, and that image is
then passed as `--image-references` to `nano_banana_pro` for every real shot.
Identity from the Soul, rendering from the better model.

`reference/generated-raw/maya-nbp.png` is that anchor image. Every character
prompt in this file was generated with it as the reference, which is what keeps
one recognisable person across the whole site.

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

   Raw generations are multi-megabyte PNGs. That script resizes each to the size it
   is actually displayed at (doubled, for retina) and encodes WebP - the current set
   of thirteen comes to roughly 1.5 MB in total.

`reference/generated-raw/` is gitignored - raw files stay on the machine that made
them. `public/brand/` is committed and served. A fresh clone therefore has the web
assets but not the originals, which is why the prompts below are the real record.

## The prompts

Thirteen assets. Every one asks for no text, no logos and no watermarks, because a
generated word in an image cannot be translated, corrected, or trusted to be spelled
right - and for the offer panels, because the words are rendered as HTML on top.

The house style, appended to every photographic prompt so the set matches: soft
diffused daylight, muted editorial colour grade on ivory and deep navy with restrained
gold, medium format 85mm, shallow depth of field, visible fabric texture and drape,
quiet and unhurried. A heritage textile house, not fast fashion.

`Ref` marks the shots generated with `--image-references reference/generated-raw/maya-nbp.png`,
which is what keeps Maya recognisably the same person across the site.

| Asset               | Model             | Ratio | Ref  |
| ------------------- | ----------------- | ----- | ---- |
| `hero`              | `nano_banana_pro` | 16:9  | Maya |
| `edit-batik-frock`  | `nano_banana_pro` | 3:4   | Maya |
| `edit-flower-frock` | `nano_banana_pro` | 3:4   | Maya |
| `edit-sarong`       | `nano_banana_pro` | 3:4   | Maya |
| `look-1`            | `nano_banana_pro` | 3:4   | Maya |
| `look-2`            | `nano_banana_pro` | 3:4   | Maya |
| `look-3`            | `nano_banana_pro` | 3:4   | Maya |
| `craft-wax`         | `nano_banana_pro` | 4:3   | -    |
| `craft-dye`         | `nano_banana_pro` | 4:3   | -    |
| `detail-batik`      | `nano_banana_pro` | 4:3   | -    |
| `offer-delivery`    | `gpt_image_2`     | 3:2   | -    |
| `offer-loyalty`     | `gpt_image_2`     | 3:2   | -    |
| `offer-seasonal`    | `gpt_image_2`     | 3:2   | -    |

### `hero` - 16:9

> Wide editorial fashion photograph for a boutique Sri Lankan clothing brand. She stands at the RIGHT THIRD of the frame, full length, wearing a hand-dyed batik frock in deep indigo and warm gold with the wax-resist pattern clearly visible. The LEFT TWO THIRDS is a calm empty cream plastered wall with generous negative space for text overlay. Looking away from camera, composed. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `edit-batik-frock` - 3:4

> Editorial fashion photograph for a boutique Sri Lankan clothing brand. She wears a hand-dyed batik frock in deep indigo and warm gold, the wax-resist pattern clearly visible across the fabric, knee-length with a soft A-line skirt and short sleeves. Standing full-length in three-quarter view beside a cream plastered wall, soft diffused morning daylight from the left, gentle shadow falloff. Calm, composed expression, looking slightly away from camera. Medium format, 85mm, shallow depth of field. Muted warm colour grade, ivory and deep navy dominant with restrained gold. Fabric texture, drape and batik crackle detail clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `edit-flower-frock` - 3:4

> Editorial fashion photograph. She wears a Sri Lankan flower frock - a knee-length cotton dress in a small hand-printed floral pattern, dusty rose and blush on cream, with a fitted bodice and gathered skirt. Three-quarter view, standing beside a cream plastered wall. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `edit-sarong` - 3:4

> Editorial fashion photograph. She wears a Sri Lankan batik sarong wrapped as a long skirt in indigo and gold wax-resist pattern, paired with a simple fitted cream cotton blouse. Full length, three-quarter view, standing beside a cream plastered wall, one hand resting at the wrap. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `look-1` - 3:4

> Editorial fashion photograph, seated. She wears a hand-dyed batik frock in indigo and gold on a simple wooden chair beside an open shuttered window, soft light across the fabric, looking out of frame. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `look-2` - 3:4

> Editorial fashion photograph, walking. She wears a flowing Sri Lankan flower frock in blush and cream, mid-stride along a shaded colonnade, skirt caught in motion, natural movement. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `look-3` - 3:4

> Close editorial detail photograph from the shoulders down, no face in frame. Hands adjusting the waist of a batik sarong in indigo and gold, wax-resist pattern and cotton weave in sharp detail. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `craft-wax` - 4:3

> Documentary photograph of Sri Lankan batik making. Close view of a craftsperson's hands drawing hot wax with a small copper tjanting tool onto stretched white cotton, tracing a fine floral pattern. Wax pot and brushes on a worn timber bench, warm light through a shuttered window. Face not visible. Respectful, unstaged documentary. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `craft-dye` - 4:3

> Documentary photograph of Sri Lankan batik dyeing. Wet indigo-dyed cotton cloth being lifted dripping from a deep dye vat by gloved hands, deep blue running down the fabric, steam and wet stone floor. Face not visible. Rich indigo against warm timber and cream walls. Respectful, unstaged documentary. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `detail-batik` - 4:3

> Extreme macro photograph of finished Sri Lankan batik cotton. Fills the frame with the wax-resist pattern in deep indigo and warm gold, the characteristic fine crackle veining where wax cracked and dye seeped through clearly visible, individual cotton fibres in focus. Raking side light. Soft diffused natural daylight, muted warm editorial colour grade with ivory and deep navy dominant and restrained gold. Medium format, 85mm, shallow depth of field. Fabric texture and drape clearly rendered. Quiet, refined, unhurried - a heritage textile house, not fast fashion. No text, no logos, no watermarks.

### `offer-delivery` - 3:2

> Abstract decorative background panel inspired by Sri Lankan batik wax-resist patterning. Deep navy ground with fine warm gold linear motifs and characteristic batik crackle veining, arranged sparsely toward the edges leaving the CENTRE LARGELY EMPTY and calm for text to be placed over it later. Flat graphic treatment, elegant, restrained, no photorealism. Absolutely no text, no letters, no numbers, no logos, no watermarks.

### `offer-loyalty` - 3:2

> Abstract decorative background panel inspired by Sri Lankan batik wax-resist patterning. Dusty rose and blush ground with fine cream and soft gold floral motifs and batik crackle veining, arranged sparsely toward the edges leaving the CENTRE LARGELY EMPTY and calm for text to be placed over it later. Flat graphic treatment, elegant, restrained, no photorealism. Absolutely no text, no letters, no numbers, no logos, no watermarks.

### `offer-seasonal` - 3:2

> Abstract decorative background panel inspired by Sri Lankan batik wax-resist patterning. Warm gold and ivory ground with fine deep navy linear motifs and batik crackle veining, arranged sparsely toward the edges leaving the CENTRE LARGELY EMPTY and calm for text to be placed over it later. Flat graphic treatment, elegant, restrained, no photorealism. Absolutely no text, no letters, no numbers, no logos, no watermarks.

The three craft shots deliberately exclude faces. An invented face attached to a
claim about real artisans would be a small lie in the middle of the section that is
about honesty.

The offer panels are deliberately empty in the centre. That space is where the HTML
text sits - see `src/features/site/components/offers.tsx` for why no wording is baked
into the artwork.

## What these images are, and are not

They are **art direction, not inventory.** Nothing here is a photograph of stock the
business owns - there is no stock table yet, and no product catalogue. The site they
illustrate asks people what they are looking for; it does not offer them a specific
frock at a specific price.

That distinction is worth preserving. The moment a generated image sits next to a real
price and a Buy button, it stops being art direction and starts being a claim about a
thing that does not exist. It also means the model is a generated likeness, not a
customer or an employee, and nothing on the page says otherwise.

**What is in frame is what the business actually sells:** batik frocks, flower frocks
and sarongs. An earlier version of this set was built around sarees, which the business
does not sell - if the focus shifts again, these images shift with it.

## Still to make

- Empty-state illustrations for the back office (no leads, no results, no chart
  data) and 404/500 artwork. Not started, and worth asking the owner first whether
  these should wait for the same designer doing the logo.
- Category tiles for the wider taxonomy, if the public site ever grows a browse page.

## Replacing an image by hand

Drop your own file straight into `public/brand/` under the same name. Two things
will otherwise waste your afternoon, and both have already happened once.

**The page keeps showing the old picture.** Next.js caches every optimised
variant it has produced, keyed by the URL - and the URL did not change, so it
serves the cached copy of the file you just replaced. Stop the dev server, delete
the caches, start it again:

```bash
rm -rf .next/dev/cache/images .next/cache/images
```

**`build-brand-images.mjs` used to overwrite your file.** It now refuses to touch
any asset whose checksum does not match `public/brand/.generated.json` - the
record of what the script itself last wrote. Anything it does not recognise is
treated as yours and preserved, and it says so when it skips one. Use `--force`
only when you genuinely want the generated version back.

**Update the alt text.** Every image's description lives in
`src/features/site/content.ts`. Alt text that describes the previous photograph is
worse than none, because a screen reader states it as fact and a search engine
indexes it as one.
