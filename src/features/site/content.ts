/**
 * Public-site copy and navigation.
 *
 * Intentionally not `server-only`. Client components (the header, the mobile
 * drawer, enquire links) import from here, and anything that touches `@/lib/env`
 * would pull the config validator into the browser. Phone numbers and figure
 * placeholders live as plain constants for the same reason.
 *
 * A discount is a promise. Commercial figures stay as `TODO_FIGURE` until the
 * owner fills them - inventing one would be the same mistake as inventing a
 * heritage claim. Sample campaign copy in `campaigns.ts` is marked fictional
 * so it can be swapped for backend-driven offers later.
 */

export const WHATSAPP_NUMBER = '97450000000';

export const TODO_FIGURE = '___';

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export type NavItem = {
  href: string;
  label: string;
};

export const site = {
  name: 'Ceylon Collection',
  markPending: 'Mark arriving',
  nav: [
    { href: '/collections', label: 'Collections' },
    { href: '/journal', label: 'Journal' },
    { href: '/about', label: 'The house' },
  ] satisfies NavItem[],
  enquire: {
    label: 'Enquire',
    message: 'Hello — I would like to look at a few pieces from Ceylon Collection.',
  },
  /**
   * The strip above the header.
   *
   * Deliberately states what the house does, not what it will give you. The
   * reference design put an offer here ("complimentary tailoring on all bridal
   * orders"), and an offer is a promise - it does not go on every page of the
   * site until someone has decided the business can keep it. Facts can.
   */
  announcement: 'Chosen in Sri Lanka · Brought to you with love',

  hero: {
    sinhala: 'අපේ කම',
    title: 'The clothes that remember you.',
    /**
     * The one word in the headline set in the accent colour. It has to appear
     * in `titleLines` on the homepage verbatim or nothing is highlighted.
     */
    titleAccent: 'remember',
    body: 'Colour you already know. Cloth that holds the heat. Cut for the life you live now — selected in Sri Lanka, worn wherever you are.',
    primaryCta: 'View collections',
    secondaryCta: 'Start a conversation',
    image: '/brand/hero-1.webp',
    imageAlt:
      'A woman in an ivory textured crop top and long skirt with gold bangles, against a panelled cream wall.',
    /**
     * THE HEADLINE'S ROTATING HALF, AND ITS PICTURE.
     *
     * The pair above is the resting state - `titleAccent` and `image` are what
     * the hero shows before anything moves and what it returns to. These are the
     * alternates, played once each in this order and then dropped. Empty this
     * array and the hero is exactly the static one it used to be; nothing else
     * has to change.
     *
     * THE SLOT IS NARROWER THAN IT LOOKS, so read this before adding a word. It
     * only accepts verbs where THE CLOTHES ACT ON YOU, in the plain register the
     * rest of the copy uses. Two obvious-sounding candidates are already ruled
     * out: `trust` reverses the relationship - the customer trusts the clothes,
     * and the manifesto says so outright - and `love` is precisely the
     * sentimentality the note above bans. What is here:
     *
     * - `remember` - memory of home, and the sentence the house actually means.
     * - `know`     - "You already know how this cloth behaves in the heat."
     * - `find`     - the manifesto's thesis: distance closed, the clothes reach
     *                you rather than you reaching them.
     *
     * Three is deliberate. A fourth would be the weakest of the four and would
     * cost the other three their point.
     *
     * THE WORD IS LINE-FINAL IN `titleLines`, which is why swapping it never
     * moves anything: the slot is sized to the longest word and a shorter one
     * simply leaves rag after it. Put the rotating word anywhere but the end of
     * its line and every swap will reflow the headline.
     */
    rotation: [
      {
        word: 'know',
        image: '/brand/hero-2.webp',
        imageAlt: 'A man in a black cotton formal shirt and dark trousers in a bright office.',
        /*
          THE CARD ROTATES WITH THE PICTURE, and it has to. It is laid over the
          photograph in the corner, so a reader takes it as a caption on whatever
          is behind it whether it claims to be one or not - and a card naming a
          blush floral frock over a man in a black shirt is the kind of detail
          that makes a whole site feel unfinished.

          Every piece named here exists in `catalog.ts` and its link resolves.
          The wording is drawn from that entry's own `subtitle` and
          `description` rather than written fresh, so the hero cannot drift away
          from what the catalogue says about the same garment.
        */
        featured: {
          quote: '“The Pettah shirt — long sleeve in a quiet dobby, cut to stay in the waistband.”',
          href: '/pieces/pettah-shirt',
        },
      },
      {
        word: 'find',
        image: '/brand/hero-4.webp',
        imageAlt: 'A woman in a teal cotton shirt and dark trousers against a plain plaster wall.',
        featured: {
          quote: '“The Colombo set — light cloth, a clean line, a trouser cut for this weather.”',
          href: '/pieces/colombo-set',
        },
      },
    ],
    /**
     * The card laid over the hero photograph. It names a piece that genuinely
     * exists in `catalog.ts` (`nimali-frock`) rather than an invented one, so
     * the first thing the page says about a product is true.
     */
    featured: {
      eyebrow: 'Featured piece',
      quote: '“The Nimali frock — a small blush print on cream cotton, cut for the heat.”',
      href: '/pieces/nimali-frock',
    },
  },
  /**
   * The argument the whole site rests on, and the one place it is made outright.
   *
   * THE CUSTOMER IS NOT BEING PERSUADED, THEY ARE BEING REACHED. They already
   * know this clothing and already rate it - that is the premise, and it is why
   * there is no quality argument here at all. Telling someone their own wardrobe
   * is good is condescension; the only useful thing to tell them is that they
   * can have it again. Every beat is written from inside their knowledge.
   *
   * WHAT IT DELIBERATELY DOES NOT SAY, and this is the part to preserve if the
   * copy is ever rewritten:
   *
   * - Nothing about price, affordability, or what anything costs. The reason
   *   this business exists is access, not a discount, and framing it as the
   *   cheaper option would insult the customer and undersell the clothes.
   * - No competitor named or ranked. `It does not travel` is a fact about
   *   distance, not a swipe at whatever is on the shelves locally.
   * - No artisans, looms, wax or heritage. That is the romance a fashion site
   *   reaches for when it has nothing specific to say, and this house has
   *   something specific to say.
   *
   * `Distance is the only thing standing between you and it` is the sentence the
   * whole section exists to deliver. The house is not introducing anybody to
   * anything - it is closing a gap.
   */
  manifesto: {
    eyebrow: 'The idea',
    sinhala: 'අපේ කම',
    /** Two lines, broken by hand - `SplitReveal` masks one per line. */
    lines: ['The clothes you trust.', 'Wherever you are now.'],
    /**
     * Three beats, in the order the argument actually runs: what the customer
     * already knows, what stands in their way, what this house does about it.
     *
     * NOT A CRAFT STORY. Earlier drafts kept sliding into artisans, wax and
     * looms, which is the romance a fashion site reaches for by default and is
     * NOT this business. Nobody here is being sold a heritage narrative - they
     * already know this clothing and already trust it. The section's whole job
     * is to say: you know it, you cannot get it, we bring it. Keep it there.
     */
    beats: [
      {
        title: 'The standard is not sentiment',
        body: 'Sri Lanka has woven and traded cotton for a thousand years, and its modern industry is the only one in Asia to have ratified all twenty-seven ILO conventions — the reason the most audited labels in the world finish their garments there. That is the industry these clothes come out of.',
      },
      {
        title: 'You are not being introduced',
        body: 'Weaving on the island runs back to the sixth century BC, and patterns like katuru mala and bota pata are still in use, kept by the National Handloom Centre and by village workshops largely run by women. You already know how this cloth behaves in the heat. Nothing here needs explaining to you.',
      },
      {
        title: 'It is made to stay there',
        body: 'Clothing made for the domestic market rarely leaves it, and no amount of searching from abroad changes that. We select against the standard you would apply yourself — cloth, cut, finish — and bring each edit over whole, the way it deserves to arrive.',
      },
    ],
  },
  arrivals: {
    eyebrow: 'Just in',
    title: 'New arrivals',
    body: 'A first reading of the season. More will follow; these are the ones we would start with.',
  },
  collections: {
    eyebrow: 'The wardrobe',
    title: 'Six ways in.',
    body: 'Occasion, office, and the days between. The current edit — not the whole house.',
  },
  selected: {
    eyebrow: 'From the edit',
    title: 'Selected pieces',
    body: 'A short list, photographed as they are worn. Ask after any of them.',
  },
  /**
   * The dark split panel between the product sections and the journal.
   *
   * Deliberately NOT a craft story. The reference design this borrows its shape
   * from ran "Woven by hand, worn with pride" over a row of artisan statistics -
   * 120+ partners, 18 years, 9,000+ pieces woven. This house does not weave
   * anything. It chooses cloth other people made and carries it to Qatar, so the
   * verb is `chosen`, and the numbers are not typed in here: two are counted from
   * `catalog.ts` where the page renders them, and the third is `TODO_FIGURE`
   * until the owner fills it. "9,000+ pieces woven" is precisely the invented
   * claim this project has already refused once.
   */
  house: {
    eyebrow: 'How we choose',
    /** Author-chosen line breaks, as `SplitReveal` expects - see manifesto. */
    titleLines: ['Chosen by hand,', 'worn without ceremony.'],
    body: 'We do not weave the cloth. We choose it — piece by piece, from the makers whose work already belongs in a Sri Lankan wardrobe — and carry it to Qatar. What arrives is a short, deliberate edit rather than a warehouse: cloth that holds the heat, colour that already feels known, a cut for the life you live now.',
    image: '/brand/detail-batik.webp',
    imageAlt:
      'A close view of indigo batik cloth, the wax-resist crackle visible across the weave.',
    /** Labels only. The figures beside them are counted on the page. */
    stats: {
      collections: 'Edits in the house',
      pieces: 'Pieces in the current edit',
      /** Blank until the owner fills it, like every other `TODO_FIGURE`. */
      years: 'Years bringing pieces over',
    },
  },
  journal: {
    eyebrow: 'Notes',
    title: 'How the clothes live.',
    body: 'On cloth, cut, and the hours they are made for. Not a catalogue — a point of view.',
  },
  close: {
    eyebrow: 'The atelier',
    title: 'Tell us what you are looking for.',
    body: 'There is no basket yet. There is a conversation — fabric, size, occasion — and we take it from there.',
    cta: 'Write on WhatsApp',
    note: 'Replies during Qatar business hours.',
  },
  about: {
    eyebrow: 'The house',
    sinhala: 'අපේ කම',
    title: 'A piece of home, worn.',
    dek: 'Ceylon Collection is a small house that finds Sri Lankan clothing worth keeping, and makes it easier to reach.',
    sections: [
      {
        title: 'What we look for',
        body: 'Cloth with a hand. Colour that already belongs. A cut that knows the climate. We are not interested in a souvenir of the island, or in a winter idea of luxury worn in the heat. The pieces we bring are the ones a person who grew up with this wardrobe would still choose.',
      },
      {
        title: 'Who it is for',
        body: 'Anyone who wants clothing with a point of view. If you already know these colours, they will feel like recognition. If you do not, they will feel like a discovery — distinctive without asking you to wear someone else’s memory.',
      },
      {
        title: 'How it works',
        body: 'There is no basket yet. You write, we talk about fabric, size, occasion, and we take it from there. The conversation is the atelier.',
      },
    ],
  },
  footer: {
    sinhala: 'අපේ කම',
    line: 'Sri Lankan style, made for you.',
    /** Labels the footer's social row. The channels live in `social.ts`. */
    social: 'Follow the house',
    /**
     * THREE COLUMNS, AND NO LINK APPEARS IN TWO OF THEM. The old pair of columns
     * held five links between them of which only three went anywhere new -
     * `Enquire > WhatsApp` repeated the button directly above it, and
     * `The current edit` was `/collections` under a second name. A directory
     * whose entries overlap teaches a reader that the footer is decoration.
     *
     * That is also why there is no `Ask on WhatsApp` line under `Ordering`,
     * tempting as it looks: the enquire button sits in the same footer,
     * larger and harder to miss, and pointing a directory entry at a
     * destination the block beside it already owns is the same duplication
     * in a new coat.
     *
     * Every `/policies/*` link resolves to a real page - see `policies.ts`. Add
     * a link here only alongside the page it opens.
     */
    columns: [
      {
        title: 'Explore',
        links: [
          { href: '/collections', label: 'Collections' },
          { href: '/journal', label: 'Journal' },
          { href: '/about', label: 'The house' },
        ],
      },
      {
        title: 'Ordering',
        links: [
          { href: '/policies/how-to-order', label: 'How to order' },
          { href: '/policies/delivery', label: 'Delivery' },
          { href: '/policies/returns', label: 'Returns and exchanges' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { href: '/policies/privacy', label: 'Privacy policy' },
          { href: '/policies/terms', label: 'Terms of use' },
        ],
      },
    ],
    legal: 'Selected in Sri Lanka. Worn beyond the island.',
    /**
     * The one fact the legal bar carries beyond the copyright line. It is a
     * statement about where the business operates, not an address - the house
     * has no shopfront to send anyone to, and inventing one to fill the corner
     * would be the same class of mistake as inventing an offer figure.
     */
    region: 'Sri Lanka to Qatar',
    /** Sends the reader back up a long page. `#top` needs no target element. */
    backToTop: 'Back to top',
  },
} as const;
