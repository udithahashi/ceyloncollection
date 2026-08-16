/**
 * Everything the public site says, in one place.
 *
 * Copy as data rather than scattered through JSX, because this is the text most
 * likely to be corrected by the owner - a phone number, a discount, a category
 * name - and hunting it across ten components is how a site ends up saying two
 * different things in two places.
 *
 * NO `server-only` HERE, ON PURPOSE. This module is imported by client
 * components for the animated sections, so it must stay free of anything that
 * reaches `@/lib/env` - the trap documented at length in AGENTS.md and
 * CONCEPTS.md. Plain strings and numbers only.
 *
 * WHAT THIS SITE IS, WHICH GOVERNS EVERY LINE BELOW
 * It is not a shop. There is no product table, no stock, no prices, no basket.
 * The business finds out what people want, then sources it on the next buying
 * trip. So the site's whole job is to start a WhatsApp conversation that lands
 * in the leads system, and every claim it makes has to be one the business can
 * keep today.
 *
 * WHAT IT SELLS, AND WHAT IT DOES NOT
 * Three things, and only three: batik frocks, flower frocks, and sarongs. All
 * three exist as real subcategories in `src/db/seed/taxonomy-data.ts`, so an
 * enquiry from this page files cleanly against the taxonomy the back office
 * already uses. **Sarees are deliberately absent** - the business does not sell
 * them yet, and an earlier revision of this file advertised them by mistake.
 */

/**
 * PLACEHOLDER. The real business number goes here before launch.
 * Digits only, no `+`, which is the form `wa.me` expects.
 */
export const WHATSAPP_NUMBER = '97450000000';

/**
 * Marks a commercial figure nobody has confirmed yet.
 *
 * Discounts and delivery thresholds are promises the business has to keep, so
 * they are never invented here. Every one renders as an obvious blank the owner
 * has to fill, and `TODO_FIGURE` makes them greppable - see the launch-blocker
 * note in docs/HANDOVER.md.
 */
export const TODO_FIGURE = '___';

/**
 * A `wa.me` deep link with the message pre-filled.
 *
 * Pre-filling matters more than it looks: an empty chat window asks the customer
 * to compose the first message, and a good share of them close it instead. It
 * also means the enquiry arrives with some structure rather than "hi".
 */
export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

const ASK = 'Hello Ceylon Collection.';

export const site = {
  name: 'Ceylon Collection',
  tagline: 'Sri Lankan batik, sourced for Qatar',

  announcement: `Free delivery across Qatar on orders over QAR ${TODO_FIGURE}`,

  nav: [
    { label: 'What we bring', href: '#collections' },
    { label: 'The craft', href: '#craft' },
    { label: 'How it works', href: '#how' },
    { label: 'Offers', href: '#offers' },
  ],

  hero: {
    eyebrow: 'Hand-dyed in Sri Lanka',
    titleBefore: 'The batik you',
    titleEmphasis: 'cannot',
    titleAfter: 'find here',
    body: 'Batik frocks, flower frocks and sarongs, chosen by hand in Sri Lanka and brought to families in Qatar. Tell us what you are looking for — we will find it on the next trip.',
    primaryCta: 'Ask on WhatsApp',
    secondaryCta: 'See what we bring',
    whatsappMessage: `${ASK} I'm looking for something specific — can you help me find it?`,
    // Describes the photograph currently in `public/brand/hero.webp`. If that
    // file is swapped for a different garment, this line has to move with it -
    // alt text that describes the previous image is worse than none, because a
    // screen reader states it as fact and a search engine indexes it as one.
    imageAlt:
      'A woman in a floral-print frock in blush, gold and green, standing in soft daylight against a cream wall',
    scrollCue: 'Scroll',
  },

  marquee: [
    'Hand-dyed batik',
    'Sourced to order',
    'Delivered across Qatar',
    'Any size, just ask',
    'Family-run',
  ],

  /**
   * The reassurance strip. Two of the three carry a figure nobody has confirmed,
   * so they render with `TODO_FIGURE` rather than a number somebody invented.
   */
  benefits: [
    {
      icon: 'truck',
      title: 'Free delivery in Qatar',
      body: `On every order over QAR ${TODO_FIGURE}. Anywhere from Doha to Al Shamal.`,
    },
    {
      icon: 'scissors',
      title: 'Made and picked to order',
      body: 'Nothing is bought in bulk and pushed. We buy what you actually asked for.',
    },
    {
      icon: 'heart',
      title: 'Regulars pay less',
      body: `${TODO_FIGURE}% off from your ${TODO_FIGURE} order onward. We remember who you are.`,
    },
  ],

  statement: {
    eyebrow: 'Why we exist',
    // Split into lines so each can be revealed behind its own mask.
    lines: [
      'We do not guess what',
      'you want and hope it',
      'sells. You tell us,',
      'and we go and find it.',
    ],
    body: 'Most of what we bring back started as somebody sending us a photo and asking whether it was possible.',
  },

  collections: {
    eyebrow: 'What we bring',
    title: 'Three things, done properly',
    body: 'We are not trying to carry everything. These are what people in Qatar keep asking us for, and what we know how to source well.',
    items: [
      {
        slug: 'batik-frock',
        index: '01',
        eyebrow: 'Hand-dyed',
        title: 'Batik frocks',
        body: 'Wax-resist dyed by hand, so no two are identical. Cotton weights that survive a Doha summer.',
        image: '/brand/edit-batik-frock.webp',
        imageAlt: 'A hand-dyed batik frock in indigo and gold',
        whatsappMessage: `${ASK} I'm looking for a batik frock.`,
      },
      {
        slug: 'flower-frock',
        index: '02',
        eyebrow: 'Printed',
        title: 'Flower frocks',
        body: 'The small-print floral frocks people grew up with, in adult and children’s sizes.',
        image: '/brand/edit-flower-frock.webp',
        imageAlt: 'A Sri Lankan flower frock in blush and cream',
        whatsappMessage: `${ASK} I'm looking for a flower frock.`,
      },
      {
        slug: 'sarong',
        index: '03',
        eyebrow: 'Everyday',
        title: 'Sarongs',
        body: 'Batik, handloom and plain — worn at home, on the beach, or wrapped as a skirt.',
        image: '/brand/edit-sarong.webp',
        imageAlt: 'A batik sarong in indigo and gold, wrapped as a long skirt',
        whatsappMessage: `${ASK} I'm looking for a sarong.`,
      },
    ],
  },

  lookbook: {
    eyebrow: 'Lookbook',
    title: 'Recent pieces',
    body: 'A few of the things we have brought back. Ask about anything you see — or send a photo of something you have seen elsewhere.',
    items: [
      {
        image: '/brand/look-1.webp',
        alt: 'Seated, wearing a batik frock beside a shuttered window',
        caption: 'Batik frock',
      },
      {
        image: '/brand/look-2.webp',
        alt: 'Walking in a flowing flower frock along a shaded colonnade',
        caption: 'Flower frock',
      },
      {
        image: '/brand/look-3.webp',
        alt: 'Close detail of hands adjusting a batik sarong at the waist',
        caption: 'Batik sarong',
      },
    ],
    cta: 'Ask about a piece',
    whatsappMessage: `${ASK} I saw a piece on your site I'd like to ask about.`,
  },

  /**
   * The batik process, and the section that earns the brand its claim. Real
   * craft, described accurately: wax-resist dyeing, not weaving.
   */
  craft: {
    eyebrow: 'The craft',
    title: 'Wax, dye, and a great deal of patience',
    body: 'Batik is not printed. The pattern is drawn in hot wax, the cloth is dyed around it, and the wax is boiled away to reveal what was protected. Repeat for every colour. The fine cracks in the pattern are where wax broke and dye crept in — the mark of the real thing, not a flaw.',
    steps: [
      {
        number: '01',
        title: 'Drawn in wax',
        body: 'Hot wax is traced onto raw cotton with a tjanting, by hand, one line at a time.',
        image: '/brand/craft-wax.webp',
        imageAlt: 'Hands drawing hot wax onto stretched white cotton with a copper tjanting',
      },
      {
        number: '02',
        title: 'Dyed around it',
        body: 'The cloth goes into the dye. Everything the wax covered stays as it was.',
        image: '/brand/craft-dye.webp',
        imageAlt: 'Indigo-dyed cotton being lifted from a dye vat',
      },
      {
        number: '03',
        title: 'Boiled clean',
        body: 'The wax is boiled out and the pattern appears, crackle and all.',
        image: '/brand/detail-batik.webp',
        imageAlt: 'Macro detail of finished batik showing the characteristic crackle veining',
      },
    ],
  },

  how: {
    eyebrow: 'How it works',
    title: 'You describe it. We find it.',
    body: 'We do not hold a warehouse. We buy against what people have actually asked for, which is why we can find the specific thing rather than sell you the nearest thing.',
    steps: [
      {
        number: '01',
        title: 'Tell us what you want',
        body: 'A photo, a description, a size, an occasion. A screenshot from someone else’s wedding is genuinely the most useful thing you can send.',
      },
      {
        number: '02',
        title: 'We source it in Sri Lanka',
        body: 'We take your request to the batik houses and markets we buy from, and come back with what is actually available and what it costs in QAR.',
      },
      {
        number: '03',
        title: 'It reaches you in Qatar',
        body: 'You confirm before we buy. Nothing is ordered on your behalf until you have seen it and agreed the price.',
      },
    ],
  },

  /**
   * Offers. Every figure is a placeholder on purpose - see TODO_FIGURE.
   * The artwork behind each card is generated; all of this text is real HTML.
   */
  offers: {
    eyebrow: 'Offers',
    title: 'Worth knowing before you ask',
    body: 'Straightforward, and applied on WhatsApp when we quote you — there is no code to remember.',
    items: [
      {
        slug: 'delivery',
        kicker: 'Delivery',
        headline: 'Free across Qatar',
        detail: `On orders over QAR ${TODO_FIGURE}. Below that, delivery is a flat QAR ${TODO_FIGURE}.`,
        image: '/brand/offer-delivery.webp',
        tone: 'navy',
        cta: 'Ask about delivery',
        whatsappMessage: `${ASK} Can you tell me about delivery?`,
      },
      {
        slug: 'loyalty',
        kicker: 'Regulars',
        headline: `${TODO_FIGURE}% off, always`,
        detail: `From your ${TODO_FIGURE} order onward, on everything. No card, no points — we already know your number.`,
        image: '/brand/offer-loyalty.webp',
        tone: 'rose',
        cta: 'Ask about the discount',
        whatsappMessage: `${ASK} I've ordered before — can you tell me about the regulars' discount?`,
      },
      {
        slug: 'seasonal',
        kicker: 'Seasonal',
        headline: `${TODO_FIGURE}% off for Avurudu`,
        detail: `On orders placed before ${TODO_FIGURE}. Ask early — the buying trip fills up.`,
        image: '/brand/offer-seasonal.webp',
        tone: 'gold',
        cta: 'Ask about the offer',
        whatsappMessage: `${ASK} I'd like to ask about the seasonal offer.`,
      },
    ],
  },

  enquire: {
    eyebrow: 'Ask for a piece',
    title: 'What are you looking for?',
    body: 'Send a photo or just describe it. We will tell you honestly whether we can find it, roughly what it will cost, and when the next trip is.',
    cta: 'Start on WhatsApp',
    whatsappMessage: `${ASK} I'm looking for something specific — can you help me find it?`,
    note: 'We reply to messages ourselves, usually the same day.',
  },

  footer: {
    blurb:
      'Hand-dyed Sri Lankan batik, flower frocks and sarongs, sourced to order for families in Qatar.',
    columns: [
      {
        heading: 'What we bring',
        links: [
          { label: 'Batik frocks', href: '#collections' },
          { label: 'Flower frocks', href: '#collections' },
          { label: 'Sarongs', href: '#collections' },
        ],
      },
      {
        heading: 'About',
        links: [
          { label: 'The craft', href: '#craft' },
          { label: 'How it works', href: '#how' },
          { label: 'Offers', href: '#offers' },
        ],
      },
      {
        heading: 'Talk to us',
        links: [{ label: 'WhatsApp', href: whatsappLink(ASK) }],
      },
    ],
    location: 'Doha, Qatar',
  },
} as const;
