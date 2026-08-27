/**
 * The public catalogue: collections, pieces, availability.
 *
 * This is the contract a future product table will fill. The homepage, the
 * collection pages and the piece pages all read from here - nothing about a
 * garment is hardcoded into a route. When stock and orders arrive, replace the
 * arrays; leave the shapes.
 *
 * Prices are omitted on purpose. A generated photograph next to a real price
 * becomes a claim about a thing that does not exist. Availability is a status
 * the UI can already render (`available`, `made-to-order`, `coming`).
 */

export type Availability = 'available' | 'made-to-order' | 'coming';

export type Collection = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  story: string;
  image: string;
  imageAlt: string;
  gender: 'women' | 'men' | 'shared';
};

export type Piece = {
  slug: string;
  collection: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  imageAlt: string;
  availability: Availability;
  fabric: string;
  whatsappMessage: string;
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'Available to enquire',
  'made-to-order': 'Made to order',
  coming: 'Arriving next',
};

export const collections: Collection[] = [
  {
    slug: 'flower-frocks',
    title: 'Flower frocks',
    eyebrow: 'For her',
    summary: 'Small prints, gathered skirts, the garden worn at noon.',
    story:
      'The Sri Lankan flower frock is not a costume. It is a cotton dress cut for heat — fitted through the bodice, easy through the skirt, printed with the flowers that already live in the house. We look for the ones that still feel like that, and none of the ones that do not.',
    image: '/brand/flower-frocks.webp',
    imageAlt: 'A woman wearing a cream and blush flower frock in a plastered interior.',
    gender: 'women',
  },
  {
    slug: 'batik-sarong',
    title: 'Batik & sarong',
    eyebrow: 'Drawn in wax',
    summary: 'Wax-resist cloth, worn as it is worn at home.',
    story:
      'Batik is a drawing before it is a garment. Wax, crackle, dye — the cloth keeps the hand that made it. The men’s sarong here is styled as it is actually worn: wrapped, settled, not arranged for a postcard.',
    image: '/brand/batik-sarong.webp',
    imageAlt: 'A man wearing an indigo batik sarong with a cream shirt, standing on terrazzo.',
    gender: 'shared',
  },
  {
    slug: 'womens-knits',
    title: 'Women’s cotton',
    eyebrow: 'Soft days',
    summary: 'T-shirts with enough weight to hang, and nothing extra.',
    story:
      'A good cotton tee does not announce itself. It holds its shape in the heat, sits clean at the shoulder, and takes a print only when the print earns it. This is the everyday layer of the house.',
    image: '/brand/womens-cotton.webp',
    imageAlt: 'A woman in a cream cotton t-shirt on a shaded veranda.',
    gender: 'women',
  },
  {
    slug: 'mens-knits',
    title: 'Men’s cotton',
    eyebrow: 'Easy cloth',
    summary: 'Tees cut for a Sri Lankan shoulder, worn without ceremony.',
    story:
      'The same idea, for him: cotton with a hand you can feel, a neckline that stays, colour that belongs to the island without quoting it. Built to sit under a shirt or stand alone.',
    image: '/brand/mens-cotton.webp',
    imageAlt: 'A man in a navy cotton t-shirt, seated in a cream courtyard.',
    gender: 'men',
  },
  {
    slug: 'womens-office',
    title: 'Women’s office',
    eyebrow: 'The hours that ask',
    summary: 'Sets that hold their line from morning to the last meeting.',
    story:
      'Officewear for a climate that does not forgive polyester. Light, composed, cut to be taken seriously — without borrowing a winter silhouette that does not belong here.',
    image: '/brand/womens-office.webp',
    imageAlt: 'A woman in a sand-coloured office set beside a shuttered window.',
    gender: 'women',
  },
  {
    slug: 'mens-office',
    title: 'Men’s office',
    eyebrow: 'Island tailoring',
    summary: 'Shirts and trousers for rooms with air-conditioning and streets without it.',
    story:
      'A shirt that survives the walk from the car. A trouser that keeps its crease until evening. The Sri Lankan office has its own weather; the cloth should know that.',
    image: '/brand/mens-office.webp',
    imageAlt:
      'A man in a pale blue office shirt and charcoal trousers, leaning on a plaster column.',
    gender: 'men',
  },
];

export const pieces: Piece[] = [
  {
    slug: 'nimali-frock',
    collection: 'flower-frocks',
    title: 'Nimali frock',
    subtitle: 'Blush floral on cream cotton',
    description:
      'A knee-length frock with a fitted bodice and a gathered skirt. The print is small — the kind that reads as colour from across a room, and as flowers only when you are close.',
    image: '/brand/flower-frocks.webp',
    imageAlt: 'The Nimali flower frock, worn in a plastered interior.',
    availability: 'available',
    fabric: 'Printed cotton',
    whatsappMessage: 'Hello — I would like to ask about the Nimali frock.',
  },
  {
    slug: 'kandy-garden',
    collection: 'flower-frocks',
    title: 'Kandy garden',
    subtitle: 'Rose and ivory, mid-stride',
    description:
      'A slightly longer skirt, the same idea. Cut to move. The kind of dress that already knows the afternoon.',
    image: '/brand/look-2.webp',
    imageAlt: 'The Kandy garden frock caught in motion along a colonnade.',
    availability: 'made-to-order',
    fabric: 'Printed cotton',
    whatsappMessage: 'Hello — I would like to ask about the Kandy garden frock.',
  },
  {
    slug: 'indigo-wax-sarong',
    collection: 'batik-sarong',
    title: 'Indigo wax sarong',
    subtitle: 'Hand-drawn batik, men’s wrap',
    description:
      'A sarong in deep indigo and warm gold, the wax-resist crackle left visible. Styled as it is worn — wrapped, settled, not arranged.',
    image: '/brand/batik-sarong.webp',
    imageAlt: 'The indigo wax sarong, wrapped and worn with a cream shirt.',
    availability: 'available',
    fabric: 'Batik cotton',
    whatsappMessage: 'Hello — I would like to ask about the indigo wax sarong.',
  },
  {
    slug: 'galle-wax-frock',
    collection: 'batik-sarong',
    title: 'Galle wax frock',
    subtitle: 'Indigo batik, A-line',
    description:
      'The same cloth, cut as a frock. Short sleeves, a soft A-line, the pattern running across the skirt the way a drawing runs across paper.',
    image: '/brand/galle-wax.webp',
    imageAlt: 'The Galle wax frock in indigo batik, standing beside a plaster wall.',
    availability: 'available',
    fabric: 'Batik cotton',
    whatsappMessage: 'Hello — I would like to ask about the Galle wax frock.',
  },
  {
    slug: 'harbour-tee',
    collection: 'womens-knits',
    title: 'Harbour tee',
    subtitle: 'Weight enough to hang',
    description:
      'A women’s cotton tee with a clean shoulder and a neckline that stays. No print until a print earns its place.',
    image: '/brand/womens-cotton.webp',
    imageAlt: 'The Harbour tee, worn on a shaded veranda.',
    availability: 'coming',
    fabric: 'Mid-weight cotton jersey',
    whatsappMessage: 'Hello — I would like to ask about the Harbour tee.',
  },
  {
    slug: 'fort-tee',
    collection: 'mens-knits',
    title: 'Fort tee',
    subtitle: 'For the hours that are not the office',
    description:
      'A men’s tee cut for a Sri Lankan shoulder. Cotton you can feel. Colour that belongs without quoting the island.',
    image: '/brand/mens-cotton.webp',
    imageAlt: 'The Fort tee, worn seated in a cream courtyard.',
    availability: 'coming',
    fabric: 'Mid-weight cotton jersey',
    whatsappMessage: 'Hello — I would like to ask about the Fort tee.',
  },
  {
    slug: 'colombo-set',
    collection: 'womens-office',
    title: 'Colombo set',
    subtitle: 'A line that holds until evening',
    description:
      'A two-piece for rooms that ask for composure. Light cloth, a clean jacket line, a trouser that does not borrow a winter cut.',
    image: '/brand/womens-office.webp',
    imageAlt: 'The Colombo office set, worn beside a shuttered window.',
    availability: 'made-to-order',
    fabric: 'Tropical suiting cotton',
    whatsappMessage: 'Hello — I would like to ask about the Colombo office set.',
  },
  {
    slug: 'pettah-shirt',
    collection: 'mens-office',
    title: 'Pettah shirt',
    subtitle: 'A shirt that survives the walk',
    description:
      'Long sleeve, a quiet dobby, cut to stay in the waistband after the car, the lift, the meeting. The Sri Lankan office has its own weather.',
    image: '/brand/mens-office.webp',
    imageAlt: 'The Pettah shirt, worn against a plaster column.',
    availability: 'available',
    fabric: 'Cotton dobby',
    whatsappMessage: 'Hello — I would like to ask about the Pettah shirt.',
  },
];

export function getCollection(slug: string): Collection | undefined {
  return collections.find((item) => item.slug === slug);
}

export function getPiece(slug: string): Piece | undefined {
  return pieces.find((item) => item.slug === slug);
}

export function piecesIn(collectionSlug: string): Piece[] {
  return pieces.filter((item) => item.collection === collectionSlug);
}

export function newArrivals(): Piece[] {
  return pieces.filter((item) => item.availability !== 'coming').slice(0, 5);
}

export function selectedPieces(): Piece[] {
  return pieces.filter((item) =>
    ['nimali-frock', 'indigo-wax-sarong', 'galle-wax-frock', 'colombo-set'].includes(item.slug)
  );
}
