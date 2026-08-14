/**
 * The starting vocabulary, exactly as the business supplied it.
 *
 * This is data, not code: it seeds the ten taxonomy tables on a fresh database
 * and is then owned by whoever is editing the taxonomy page. Re-running the seed
 * inserts anything missing and leaves existing rows alone, so an edit made in
 * the app is never undone by a deploy - see `src/db/seed/index.ts`.
 *
 * Order within each list is meaningful: it becomes `sortOrder`, which is the
 * order the dropdowns appear in. Statuses run along the funnel rather than the
 * alphabet, and "Not Specified" is deliberately last everywhere.
 *
 * Slugs are generated from the names by `slugify`, so they are not written out
 * here. Two names in the same table must not slugify to the same string; the
 * seed fails loudly if they do.
 */
import type { SizeGroup, TagGroup } from '@/db/schema/taxonomy';
import type { BadgeTone } from '@/lib/theme/tones';

export interface SeedValue {
  name: string;
  description?: string;
}

export interface SeedStatus extends SeedValue {
  tone: BadgeTone;
  isTerminal?: boolean;
  isWon?: boolean;
}

export interface SeedPlatform extends SeedValue {
  isSocial?: boolean;
}

export interface SeedSize extends SeedValue {
  sizeGroup: SizeGroup;
}

export interface SeedUrgency extends SeedValue {
  tone: BadgeTone;
  isReadyToBuy?: boolean;
}

export interface SeedTag extends SeedValue {
  tagGroup: TagGroup;
}

/** The funnel, in order. Colour is data so a badge never needs a switch. */
export const seedLeadStatuses: SeedStatus[] = [
  { name: 'New Inquiry', tone: 'info', description: 'Just arrived, nobody has replied yet.' },
  { name: 'Contacted', tone: 'info', description: 'We have replied and are waiting on them.' },
  { name: 'Interested', tone: 'accent', description: 'They want it, but have not committed.' },
  { name: 'Sourcing', tone: 'warning', description: 'Being looked for in Sri Lanka.' },
  { name: 'Confirmed', tone: 'accent', description: 'Found, priced and agreed.' },
  { name: 'Ordered', tone: 'accent', description: 'Bought from the supplier.' },
  { name: 'Shipped', tone: 'info', description: 'On its way to Qatar.' },
  { name: 'Delivered', tone: 'success', isTerminal: true, isWon: true },
  { name: 'On Hold', tone: 'warning', description: 'Paused, but not lost.' },
  { name: 'Lost/Cancelled', tone: 'error', isTerminal: true },
];

export const seedPlatforms: SeedPlatform[] = [
  { name: 'Facebook' },
  { name: 'Instagram' },
  { name: 'WhatsApp' },
  { name: 'TikTok' },
  { name: 'Imo' },
  { name: 'Viber' },
  { name: 'Referral', isSocial: false, description: 'Sent by an existing customer.' },
  { name: 'Walk-in', isSocial: false, description: 'Asked in person.' },
  { name: 'Other', isSocial: false },
];

/**
 * Who the garment is for.
 *
 * The children's age bands from the original list live in `sizes` instead: "Kids
 * 5-6Y" answers "what size", not "who for", and keeping them here would mean a
 * girl's frock in a 7-8Y could not record both facts.
 */
export const seedClothGenders: SeedValue[] = [
  { name: 'Female' },
  { name: 'Male' },
  { name: 'Unisex' },
  { name: 'Kids - Girls' },
  { name: 'Kids - Boys' },
  { name: 'Custom/Made to Measure' },
  { name: 'Not Specified' },
];

export const seedSizes: SeedSize[] = [
  { name: 'XS', sizeGroup: 'adult' },
  { name: 'S', sizeGroup: 'adult' },
  { name: 'M', sizeGroup: 'adult' },
  { name: 'L', sizeGroup: 'adult' },
  { name: 'XL', sizeGroup: 'adult' },
  { name: 'XXL', sizeGroup: 'adult' },
  { name: '3XL', sizeGroup: 'adult' },
  { name: '4XL', sizeGroup: 'adult' },
  { name: 'Free Size', sizeGroup: 'adult' },
  { name: 'Kids 3-4Y', sizeGroup: 'kids' },
  { name: 'Kids 5-6Y', sizeGroup: 'kids' },
  { name: 'Kids 7-8Y', sizeGroup: 'kids' },
  { name: 'Kids 9-10Y', sizeGroup: 'kids' },
  { name: 'Kids 11-12Y', sizeGroup: 'kids' },
  { name: 'Custom/Made to Measure', sizeGroup: 'other' },
  {
    name: 'Unstitched Material',
    sizeGroup: 'other',
    description: 'Sold by the metre, not to a size.',
  },
  { name: 'Not Specified', sizeGroup: 'other' },
];

/** Qatar's municipalities, plus the two districts customers name by themselves. */
export const seedCities: SeedValue[] = [
  { name: 'Doha' },
  { name: 'Al Rayyan' },
  { name: 'Al Wakrah' },
  { name: 'Al Khor' },
  { name: 'Umm Salal' },
  { name: 'Al Daayen' },
  { name: 'Al Shamal' },
  { name: 'Al Shahaniya' },
  { name: 'Dukhan' },
  { name: 'Mesaieed' },
  { name: 'Lusail' },
  { name: 'The Pearl' },
  { name: 'Other/Not Specified' },
];

export const seedUrgencyLevels: SeedUrgency[] = [
  { name: 'Just Curious', tone: 'neutral' },
  { name: 'Interested', tone: 'info' },
  { name: 'Ready to Buy', tone: 'success', isReadyToBuy: true },
  { name: 'Urgent - This Week', tone: 'warning', isReadyToBuy: true },
  {
    name: 'Already Bought Elsewhere',
    tone: 'error',
    description: 'Worth recording: this is demand that was missed.',
  },
];

export const seedFabrics: SeedValue[] = [
  { name: 'Handloom Cotton' },
  { name: 'Cotton Voile' },
  { name: 'Linen' },
  { name: 'Rayon' },
  { name: 'Georgette' },
  { name: 'Chiffon' },
  { name: 'Crepe' },
  { name: 'Silk' },
  { name: 'Satin' },
  { name: 'Organza' },
  { name: 'Net' },
  { name: 'Velvet' },
  { name: 'Denim' },
  { name: 'Jersey' },
  { name: 'Nida' },
  { name: 'Chinnon' },
  { name: 'Khadi' },
  { name: 'Kanchipuram Silk' },
  { name: 'Batik Cotton' },
  { name: 'Muslin' },
  { name: 'Polyester' },
  { name: 'Viscose' },
  { name: 'Not Specified' },
];

/**
 * Categories, each with its sub-categories.
 *
 * A name may repeat under a different parent - "Batik Saree" is under both Batik
 * Wear and Sarees & Osari - because Batik Wear is a craft and Sarees & Osari is a
 * garment type. Both rows are wanted, which is why sub-category slugs are unique
 * per category rather than globally.
 */
export const seedCategories: Array<{
  name: string;
  description?: string;
  subcategories: string[];
}> = [
  {
    name: 'Batik Wear',
    description: 'Hand-worked batik, whatever the garment.',
    subcategories: [
      'Batik Frock',
      'Batik Sarong',
      'Batik Shirt',
      'Batik Blouse',
      'Batik Kaftan',
      'Batik Skirt',
      'Batik Saree',
      'Batik Kurta',
      'Batik Dupatta',
      'Batik Scarf',
      'Batik Beach Cover-up',
    ],
  },
  {
    name: 'Sarongs & Sarams',
    subcategories: [
      'Plain Sarong',
      'Checked Sarong',
      'Batik Sarong (Men)',
      'Handloom Sarong',
      'Sarong Set (Men)',
      'Redda & Hatte',
      'Lungi',
      'Beach Sarong',
    ],
  },
  {
    name: 'Sarees & Osari',
    subcategories: [
      'Kandyan Osari',
      'Cotton Saree',
      'Silk Saree',
      'Handloom Saree',
      'Batik Saree',
      'Georgette Saree',
      'Kanchipuram Saree',
      'Party Saree',
      'Ready-made Saree',
      'Saree Blouse',
      'Petticoat/Underskirt',
    ],
  },
  {
    name: 'Frocks & Dresses',
    subcategories: [
      'Flower Frock',
      'Batik Frock',
      'Party Frock',
      'Long Frock',
      'Short Frock',
      'Maxi Dress',
      'Midi Dress',
      'Shirt Dress',
      'Wrap Dress',
      'Denim Dress',
      'Kaftan Dress',
      'Office Dress',
    ],
  },
  {
    name: 'Handloom',
    description: 'Woven on a hand loom - the fabric people ask for by name.',
    subcategories: [
      'Handloom Saree',
      'Handloom Sarong',
      'Handloom Shirt',
      'Handloom Frock',
      'Handloom Skirt',
      'Handloom Blouse',
      'Handloom Shawl',
    ],
  },
  {
    name: 'Tops & Blouses',
    subcategories: [
      'Casual Blouse',
      'Office Blouse',
      'Crop Top',
      'Tunic',
      'T-Shirt',
      'Shirt (Ladies)',
      'Kurti',
      'Tank Top',
      'Peplum Top',
      'Off-Shoulder Top',
    ],
  },
  {
    name: 'Bottoms',
    subcategories: [
      'Palazzo',
      'Wide-leg Pants',
      'Denim Jeans',
      'Leggings',
      'Culottes',
      'Skirt (Long)',
      'Skirt (Short)',
      'Shorts',
      'Trousers',
      'Harem Pants',
    ],
  },
  {
    name: 'Ethnic & Kurta Sets',
    subcategories: [
      'Kurta Set',
      'Salwar Kameez',
      'Anarkali',
      'Lehenga',
      'Churidar Set',
      'Sherwani',
      'Nehru Jacket',
      'Dhoti',
      'Kurta (Men)',
      'Dupatta/Shawl',
    ],
  },
  {
    name: 'Abaya & Modest Wear',
    subcategories: [
      'Everyday Abaya',
      'Party Abaya',
      'Open Abaya',
      'Kimono',
      'Jilbab',
      'Hijab',
      'Shayla',
      'Niqab',
      'Modest Maxi',
      'Prayer Dress',
    ],
  },
  {
    name: 'Kids Wear',
    subcategories: [
      'Kids Frock',
      'Kids Batik Frock',
      'Kids Party Dress',
      'Kids Shirt',
      'Kids T-Shirt',
      'Kids Shorts',
      'Kids Sarong',
      'Kids Kurta Set',
      'Kids Skirt',
      'Kids School Uniform',
      'Kids Baby Romper',
      'Kids Family Matching Set',
    ],
  },
  {
    name: "Men's Wear",
    subcategories: [
      'Men Shirt (Casual)',
      'Men Shirt (Formal)',
      'Men Batik Shirt',
      'Men T-Shirt',
      'Men Sarong',
      'Men Trousers',
      'Men Denim',
      'Men Shorts',
      'Men Kurta',
      'Men Suit',
    ],
  },
  {
    name: 'Outerwear',
    subcategories: [
      'Denim Jacket',
      'Blazer',
      'Cardigan',
      'Shrug',
      'Kimono Jacket',
      'Coat',
      'Hoodie',
      'Sweatshirt',
    ],
  },
  {
    name: 'Activewear',
    subcategories: [
      'Track Suit',
      'Gym Leggings',
      'Sports Bra',
      'Jogger',
      'Sports T-Shirt',
      'Yoga Set',
      'Swimwear',
    ],
  },
  {
    name: 'Nightwear & Loungewear',
    subcategories: [
      'Nighty',
      'Night Dress',
      'Pyjama Set',
      'Kaftan (Home)',
      'Housecoat',
      'Lounge Set',
      'Bathrobe',
    ],
  },
  {
    name: 'Innerwear',
    subcategories: ['Bra', 'Panty', 'Camisole', 'Slip', 'Shapewear', 'Vest (Men)', 'Boxer/Brief'],
  },
  {
    name: 'Accessories',
    subcategories: [
      'Scarf',
      'Stole',
      'Shawl',
      'Dupatta',
      'Hair Band',
      'Belt',
      'Handbag',
      'Jewellery Set',
      'Hijab Pin',
      'Socks',
    ],
  },
  {
    name: 'Footwear',
    subcategories: ['Sandals', 'Slippers', 'Heels', 'Flats', 'Wedges', 'Sneakers', 'Kids Shoes'],
  },
  {
    name: 'Wedding & Bridal',
    subcategories: [
      'Bridal Saree',
      'Bridal Osari',
      'Bridal Lehenga',
      'Bridesmaid Dress',
      'Homecoming Saree',
      'Groom Suit',
      'Groom Sherwani',
      'Flower Girl Dress',
    ],
  },
];

/**
 * Tags, in their eight groups.
 *
 * Written group by group because that is how they are picked. One flat list of
 * 122 is a scroll bar; eight labelled groups is a menu.
 */
const tagsByGroup: Record<TagGroup, string[]> = {
  print: [
    'Batik Hand-Drawn',
    'Batik Block Print',
    'Batik Tie-Dye',
    'Floral Print',
    'Ethnic/Tribal Print',
    'Checked',
    'Striped',
    'Polka Dot',
    'Animal Print',
    'Geometric',
    'Paisley',
    'Solid/Plain',
    'Ombre',
    'Colour Block',
    'Embroidered',
    'Sequinned',
    'Beaded',
    'Lace Detail',
    'Mirror Work',
    'Zari/Gold Thread',
    'Hand Painted',
    'Screen Print',
    'Digital Print',
    'Kandyan Motif',
    'Peacock Motif',
    'Elephant Motif',
    'Lotus Motif',
  ],
  silhouette: [
    'A-Line',
    'Maxi',
    'Midi',
    'Mini',
    'Bodycon',
    'Fit & Flare',
    'Wrap',
    'Shift',
    'Empire Line',
    'Peplum',
    'Tiered',
    'Layered',
    'Asymmetric',
    'Straight Cut',
    'Wide Leg',
    'Palazzo',
    'Flared',
    'Skinny',
    'Bootcut',
    'Culottes',
    'Oversized',
    'Regular Fit',
    'Slim Fit',
  ],
  length: [
    'Floor Length',
    'Ankle Length',
    'Calf Length',
    'Knee Length',
    'Above Knee',
    'Hip Length',
    'Tunic Length',
    'Cropped',
  ],
  neckline: [
    'Round Neck',
    'V-Neck',
    'Boat Neck',
    'Halter Neck',
    'Off-Shoulder',
    'One-Shoulder',
    'Square Neck',
    'Sweetheart',
    'Collared',
    'Mandarin Collar',
    'High Neck',
    'Keyhole',
    'Cold Shoulder',
  ],
  sleeve: [
    'Sleeveless',
    'Cap Sleeve',
    'Short Sleeve',
    '3/4 Sleeve',
    'Full Sleeve',
    'Bell Sleeve',
    'Puff Sleeve',
    'Bishop Sleeve',
    'Balloon Sleeve',
    'Flutter Sleeve',
    'Kimono Sleeve',
    'Raglan Sleeve',
  ],
  occasion: [
    'Casual/Daily',
    'Office/Formal',
    'Party/Evening',
    'Wedding',
    'Bridal',
    'Homecoming',
    'Avurudu/New Year',
    'Ramadan/Eid',
    'Poya/Temple',
    'Beach/Resort',
    'Festival',
    'Loungewear',
    'Maternity',
    'School',
    'Gym/Sports',
  ],
  details: [
    'Pockets',
    'Elasticated Waist',
    'Drawstring',
    'Button-Down',
    'Zip Closure',
    'Lined',
    'Reversible',
    'Two-Piece Set',
    'Three-Piece Set',
    'Matching Dupatta',
    'Matching Hijab',
    'Belted',
    'Pleated',
    'Ruffled',
    'Smocked',
    'Front Slit',
  ],
  origin: [
    'Handmade',
    'Sri Lankan Handloom',
    'Locally Made',
    'Imported',
    'Export Quality',
    'Plus Size',
    'Petite',
    'Family Matching Set',
  ],
};

/** Flattened in group order, which is also the order they are displayed in. */
export const seedTags: SeedTag[] = Object.entries(tagsByGroup).flatMap(([group, names]) =>
  names.map((name) => ({ name, tagGroup: group as TagGroup }))
);
