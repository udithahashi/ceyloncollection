/**
 * Editorial journal. Short, specific, not a culture lecture.
 *
 * Each story is a page. The homepage only shows the first three. When a CMS
 * arrives, this file is the shape it should fill.
 */

export type Story = {
  slug: string;
  eyebrow: string;
  title: string;
  dek: string;
  image: string;
  imageAlt: string;
  body: string[];
};

export const stories: Story[] = [
  {
    slug: 'wearing-batik-after-noon',
    eyebrow: 'Cloth',
    title: 'Wearing batik after noon.',
    dek: 'The crackle is not decoration. It is the record of the wax giving way.',
    image: '/brand/detail-batik.webp',
    imageAlt: 'Macro photograph of indigo and gold batik cotton, wax-resist crackle in focus.',
    body: [
      'Batik that has been drawn properly does not sit flat. The wax cracks, the dye finds the break, and the cloth keeps a map of that moment. You can see it in raking light — a fine veining no print run will invent later.',
      'We look for that. Not for a motif that says “Sri Lanka” from across a room, but for cloth that still behaves like cloth: weight, drape, the slight stiffness of a waxed cotton that has been washed into itself.',
      'After noon, in heat, that is what you feel first. The pattern comes second.',
    ],
  },
  {
    slug: 'office-in-island-light',
    eyebrow: 'Cut',
    title: 'The office, in island light.',
    dek: 'A winter silhouette is a kind of dishonesty here.',
    image: '/brand/craft-wax.webp',
    imageAlt: 'Hands drawing hot wax onto cotton with a copper tjanting tool.',
    body: [
      'The Sri Lankan office is air-conditioned and the street is not. A shirt has to survive both. That is a cutting problem before it is a style problem.',
      'We are not interested in importing a Northern idea of formality and calling it elevation. The elevation is a cloth that stays composed at four o’clock, a trouser that does not cling, a set that can be taken seriously without quoting another climate.',
    ],
  },
  {
    slug: 'what-a-sarong-knows',
    eyebrow: 'Wear',
    title: 'What a sarong knows.',
    dek: 'It is a garment with a memory of how it is wrapped.',
    image: '/brand/edit-sarong.webp',
    imageAlt: 'A batik sarong wrapped and worn at full length.',
    body: [
      'A sarong that has been styled for a photograph and a sarong that has been worn are not the same object. One is arranged. The other has settled.',
      'The men’s pieces in this house are photographed the second way. If that looks less like a campaign and more like a person who got dressed, that is the point.',
    ],
  },
];

export function getStory(slug: string): Story | undefined {
  return stories.find((item) => item.slug === slug);
}

export function featuredStories(): Story[] {
  return stories.slice(0, 3);
}
