/**
 * Everything the public site says, in one place.
 *
 * Copy as data rather than scattered through JSX, because this is the text most
 * likely to be corrected by the owner - a phone number, a claim, a category name -
 * and hunting it across six components is how a site ends up saying two different
 * things in two places.
 *
 * NO `server-only` HERE, ON PURPOSE. This module is imported by client components
 * for the animated sections, so it must stay free of anything that reaches
 * `@/lib/env` - the trap documented at length in AGENTS.md and CONCEPTS.md. Plain
 * strings and numbers only. If something here ever needs a formatted date, format
 * it on the server and pass the string in.
 *
 * WHAT THIS SITE IS, WHICH GOVERNS EVERY LINE BELOW
 * It is not a shop. There is no product table, no stock, no prices, no basket -
 * see docs/HANDOVER.md. The business finds out what people want, then sources it
 * on the next buying trip. So the site's whole job is to start a WhatsApp
 * conversation that arrives in the leads system, and every claim it makes has to
 * be one the business can actually keep today.
 *
 * The reference design at reference/public-website.html is the visual source of
 * truth and NOT the copy source: it was written for a Colombo boutique selling
 * finished stock in LKR with island-wide delivery. This is a Qatar import
 * business serving Sri Lankan families, so prices, places and promises all differ.
 */

/** The business's WhatsApp number, in the form `wa.me` expects: digits only. */
export const WHATSAPP_NUMBER = '97450000000';

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

export const site = {
  name: 'Ceylon Collection',
  tagline: 'Sri Lankan clothing, sourced for Qatar',

  announcement: 'Sourced to order from Sri Lanka · Delivered across Qatar',

  nav: [
    { label: 'What we bring', href: '#collections' },
    { label: 'How it works', href: '#how' },
    { label: 'Our craft', href: '#craft' },
    { label: 'Ask for a piece', href: '#enquire' },
  ],

  hero: {
    eyebrow: 'Ceylon Collection',
    // Split so the italic word can be styled without dangerouslySetInnerHTML.
    titleBefore: 'The saree you cannot find',
    titleEmphasis: 'here',
    titleAfter: '',
    body: 'Handloom sarees, occasion wear and everyday cotton, chosen in Sri Lanka and brought to families in Qatar. Tell us what you are looking for and we will find it on the next trip.',
    primaryCta: 'Ask on WhatsApp',
    secondaryCta: 'See what we bring',
    // The pre-filled first message. Deliberately a prompt, not a greeting.
    whatsappMessage:
      "Hello Ceylon Collection. I'm looking for something specific — can you help me find it?",
    imageAlt:
      'A woman in a navy handloom saree with a gold thread border, standing in soft daylight',
    caption: 'Handloom cotton-silk, gold thread border',
  },

  /** The scrolling strip under the hero. Short, true, and about the service. */
  marquee: [
    'Sourced to order',
    'Handloom from Sri Lanka',
    'Delivered across Qatar',
    'Ask for any size',
    'Family-run',
  ],

  collections: {
    eyebrow: 'What we bring',
    title: 'Three things people ask us for most',
    body: 'Not a catalogue — a starting point. If what you want is not here, it is still worth asking, because most of what we source began as somebody describing it to us.',
    items: [
      {
        slug: 'saree',
        eyebrow: 'Handloom',
        title: 'Sarees',
        body: 'Cotton, cotton-silk and silk handloom from the hill country, in the weights that actually work for Doha weather.',
        image: '/brand/edit-saree.webp',
        imageAlt: 'A folded navy handloom saree with a gold thread border on cream linen',
        whatsappMessage: "Hello Ceylon Collection. I'm looking for a handloom saree.",
      },
      {
        slug: 'occasion',
        eyebrow: 'Occasion',
        title: 'Frocks & party wear',
        body: 'Occasion wear for weddings, Avurudu and family functions, in adult and children’s sizes.',
        image: '/brand/edit-occasion.webp',
        imageAlt: 'An occasion frock in dusty rose and blush, softly draped on a cream surface',
        whatsappMessage: "Hello Ceylon Collection. I'm looking for occasion wear.",
      },
      {
        slug: 'everyday',
        eyebrow: 'Everyday',
        title: 'Cotton & batik',
        body: 'Light cotton and hand-block batik for every day — the pieces people ask us to bring back two and three at a time.',
        image: '/brand/edit-everyday.webp',
        imageAlt: 'Folded cotton and batik fabrics in gold, ochre and cream tones',
        whatsappMessage: "Hello Ceylon Collection. I'm looking for everyday cotton or batik.",
      },
    ],
  },

  /**
   * The honest explanation of a sourcing business, and the section that does the
   * most work on this page. Someone who expects to click Buy needs to understand
   * within one screen why there is no Buy button, or they leave thinking the site
   * is broken rather than that the model is different.
   */
  how: {
    eyebrow: 'How it works',
    title: 'You describe it. We find it.',
    body: 'We do not hold a warehouse of stock. We buy against what people have actually asked for, which is why we can find the specific thing rather than sell you the nearest thing.',
    steps: [
      {
        number: '01',
        title: 'Tell us what you want',
        body: 'A photo, a description, a size, an occasion. A screenshot from someone else’s wedding is genuinely the most useful thing you can send.',
      },
      {
        number: '02',
        title: 'We source it in Sri Lanka',
        body: 'We take your request to the weavers and markets we buy from, and come back to you with what is actually available, and what it costs in QAR.',
      },
      {
        number: '03',
        title: 'It reaches you in Qatar',
        body: 'You confirm before we buy. Nothing is ordered on your behalf until you have seen it and agreed the price.',
      },
    ],
  },

  craft: {
    eyebrow: 'Our craft',
    title: 'Woven by hand, before it was ever a trend',
    body: 'Sri Lankan handloom is a working craft, not a heritage exhibit — small weaving houses in the hill country, dyeing and warping and weaving to order the way they always have. Buying against real requests is what lets us keep going back to them.',
    imageAlt:
      'A traditional Sri Lankan handloom with navy and gold warp threads, a weaver passing the shuttle',
    // Facts about the service, deliberately not invented production statistics.
    // "9,000+ pieces woven" would be a lie this business cannot currently back.
    stats: [
      { value: 'Made to order', label: 'Nothing mass-bought' },
      { value: 'Qatar-wide', label: 'Delivered locally' },
      { value: 'Family-run', label: 'You talk to us directly' },
    ],
  },

  enquire: {
    eyebrow: 'Ask for a piece',
    title: 'What are you looking for?',
    body: 'Send a photo or just describe it. We will tell you honestly whether we can find it, roughly what it will cost, and when the next trip is.',
    cta: 'Start on WhatsApp',
    whatsappMessage:
      "Hello Ceylon Collection. I'm looking for something specific — can you help me find it?",
    note: 'We reply to messages ourselves, usually the same day.',
  },

  footer: {
    blurb:
      'Sri Lankan clothing, sourced to order for families in Qatar. Handloom sarees, occasion wear and everyday cotton.',
    columns: [
      {
        heading: 'What we bring',
        links: [
          { label: 'Sarees', href: '#collections' },
          { label: 'Frocks & party wear', href: '#collections' },
          { label: 'Cotton & batik', href: '#collections' },
        ],
      },
      {
        heading: 'About',
        links: [
          { label: 'How it works', href: '#how' },
          { label: 'Our craft', href: '#craft' },
        ],
      },
      {
        heading: 'Talk to us',
        links: [{ label: 'WhatsApp', href: whatsappLink('Hello Ceylon Collection.') }],
      },
    ],
    location: 'Doha, Qatar',
  },
} as const;
