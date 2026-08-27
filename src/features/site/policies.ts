/**
 * The footer's policy pages.
 *
 * WHY THESE EXIST AS DATA. A footer that links to `/policies/returns` and gets a
 * 404 is worse than a footer with no policy links at all, so the links and the
 * pages ship together. Keeping the prose here rather than in JSX means the owner
 * can settle the terms without touching a component.
 *
 * NOTHING HERE INVENTS A COMMITMENT, and that is the rule to keep. A return
 * window, a delivery charge, a retention period and a registered company name
 * are promises the business has to keep - the same reason `TODO_FIGURE` exists
 * for the offer figures. Where a term is genuinely the owner's to set it is
 * NOT written as a plausible-sounding default: it goes in `pending`, and the
 * page renders a visible notice naming what is still being agreed and pointing
 * at WhatsApp. Guessing "14 days" here would be a customer-facing lie the
 * moment someone held us to it.
 *
 * What IS written is what is true of the system as built: the public site sets
 * no cookies and loads no third-party trackers, enquiries arrive over WhatsApp,
 * the back office files them by phone number, photographs are deleted outright
 * while enquiry records are soft-deleted. Those are facts about the code, not
 * marketing, and they are checkable.
 *
 * THE HOUSE VOICE APPLIES HERE TOO - see the note above `site.manifesto`. Plain,
 * declarative, addressed to someone who already knows the clothes. No romance,
 * no filler, nothing about being the cheaper option.
 */

export type PolicySection = {
  heading: string;
  /** One paragraph per entry. */
  body: string[];
};

export type Policy = {
  slug: string;
  /** Groups the page under its footer column - `Ordering` or `Legal`. */
  eyebrow: string;
  title: string;
  /** One sentence under the title. Also the page's meta description. */
  summary: string;
  sections: PolicySection[];
  /**
   * Terms the owner has still to set. Anything listed renders as a notice at
   * the foot of the page rather than as a blank inside the prose, so a visitor
   * is never shown half a sentence and the page is never mistaken for finished.
   * Empty this array and the notice disappears on its own.
   */
  pending: string[];
};

export const policies: Policy[] = [
  {
    slug: 'how-to-order',
    eyebrow: 'Ordering',
    title: 'How to order',
    summary: 'There is no basket on this site, and that is deliberate.',
    sections: [
      {
        heading: 'The short version',
        body: [
          'Find the piece you want and press any enquire link. A WhatsApp message opens with the piece already named. We reply with what is in stock, in which sizes, and what it costs.',
          'Nothing is charged on this website. There is no checkout here, and no card details are ever entered on these pages.',
        ],
      },
      {
        heading: 'Why it works this way',
        body: [
          'The edit is short and it moves. A basket that says "in stock" is a promise about a shelf, and this house does not keep a shelf - it keeps a small list of pieces chosen one at a time. Asking is quicker than a page that has to guess.',
          'It also lets you ask what a size chart cannot answer: how the cloth sits in the heat, whether a cut runs long, what else came over in the same cotton.',
        ],
      },
      {
        heading: 'What we will ask you',
        body: [
          'The piece, your size, and where you are. That is enough to reply. We keep a record of the conversation so you are not asked the same questions next time - the privacy policy sets out exactly what that record holds.',
        ],
      },
    ],
    pending: [],
  },
  {
    slug: 'delivery',
    eyebrow: 'Ordering',
    title: 'Delivery',
    summary: 'How a piece gets from the island to you.',
    sections: [
      {
        heading: 'How it reaches you',
        body: [
          'Pieces are chosen in Sri Lanka and brought over as a whole edit rather than shipped one at a time. Once an edit has landed, delivery is arranged inside the same conversation the order was made in.',
        ],
      },
      {
        heading: 'If a piece has not landed yet',
        body: [
          'Some of what you see here is part of an edit still to come over. We will say so plainly when you ask, rather than take an order against a date we cannot promise.',
        ],
      },
    ],
    pending: [
      'Which areas are covered, and whether anywhere outside Qatar is served',
      'How long delivery takes once a piece is here',
      'What delivery costs, and any order size that waives it',
    ],
  },
  {
    slug: 'returns',
    eyebrow: 'Ordering',
    title: 'Returns and exchanges',
    summary: 'Cloth behaves differently on a body than it does in a photograph.',
    sections: [
      {
        heading: 'Tell us first',
        body: [
          'Message the same WhatsApp conversation the order was made in. It already carries the piece, the size and the date, so nothing has to be looked up and you do not have to explain the order again.',
        ],
      },
      {
        heading: 'Before you send anything back',
        body: [
          'Keep the piece as it arrived and do not remove anything attached to it until you are sure. A piece that has been worn out of the house, altered or washed is a different piece, and the terms below will treat it as one.',
        ],
      },
    ],
    pending: [
      'How long after delivery a return can be raised',
      'What condition a piece has to be in to come back',
      'Whether the house or the customer covers return carriage',
      'Whether exchanges are offered, and on what',
      'What happens with altered or made-to-measure pieces',
    ],
  },
  {
    slug: 'privacy',
    eyebrow: 'Legal',
    title: 'Privacy policy',
    summary: 'What this house knows about you, and how it came to know it.',
    sections: [
      {
        heading: 'This website collects nothing',
        body: [
          'These pages set no cookies, run no advertising pixels and load no third-party analytics. Reading the site leaves no record of you with us at all.',
          'Your browser still asks our server for pages and photographs, and the server keeps ordinary request logs the way every web server does. Those logs are not tied to a person and are not used to build one.',
        ],
      },
      {
        heading: 'What we keep once you message us',
        body: [
          'Every enquiry arrives over WhatsApp. When one does, we record your name, your phone number, what you asked about and any photographs you send, in a private back office that only the house can reach.',
          'The phone number is how the record is filed. It is the one thing that stays the same between one conversation and the next, which is what lets us pick up where we left off instead of starting again.',
        ],
      },
      {
        heading: 'WhatsApp is not us',
        body: [
          'The conversation itself lives in WhatsApp, which belongs to Meta and not to this house. What Meta records about the fact that you messaged a business is governed by their policy, not by this one.',
        ],
      },
      {
        heading: 'What we do not do',
        body: [
          'We do not sell your details, rent them, or pass them to advertisers. Nobody outside the house sees the enquiry records.',
        ],
      },
      {
        heading: 'Asking to see it, or to have it removed',
        body: [
          'Ask in the same conversation. Photographs you sent are deleted outright - the file is removed, not hidden.',
          'The written enquiry record is retired instead: it stops appearing anywhere in the house, and a dated note that it was retired is kept so we can show what happened and when. How long a retired record is held before it is destroyed is one of the terms still being settled, below.',
        ],
      },
    ],
    pending: [
      'How long a retired enquiry record is kept before it is destroyed',
      'The registered business name behind Ceylon Collection',
      'Whether privacy requests can be made anywhere other than WhatsApp',
    ],
  },
  {
    slug: 'terms',
    eyebrow: 'Legal',
    title: 'Terms of use',
    summary: 'What this website is, and what it is not.',
    sections: [
      {
        heading: 'A catalogue, not a shop',
        body: [
          'Nothing on this site is an offer to sell. There is no basket, no checkout and no payment page. Availability, size and price are confirmed in conversation before anything is agreed, and only what is agreed there binds either of us.',
        ],
      },
      {
        heading: 'Photographs and colour',
        body: [
          'Pieces are photographed as they are, not as a rendering. Screens differ from one another and from daylight, so colour on your screen is not a guarantee of colour in the hand. If an exact shade matters, ask before you order and we will describe it.',
        ],
      },
      {
        heading: 'What is on these pages belongs to the house',
        body: [
          'The words, the photographs and the marks on this site are the property of Ceylon Collection. Please do not republish them as your own.',
        ],
      },
      {
        heading: 'Questions about these terms',
        body: [
          'They go to the same WhatsApp number as everything else. There is no separate desk.',
        ],
      },
    ],
    pending: ['The registered business name and the country whose law these terms sit under'],
  },
];

/** Looks a policy up by slug. Returns `undefined` so the route can `notFound()`. */
export function getPolicy(slug: string): Policy | undefined {
  return policies.find((policy) => policy.slug === slug);
}
