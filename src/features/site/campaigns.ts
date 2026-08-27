/**
 * Promotional campaigns. Visually distinct from the permanent brand story,
 * and shaped so a future backend can replace the array without touching the UI.
 *
 * The figures here are fictional samples. They are not promises. The live site
 * must not ship them as fact once offers are real - swap the data, keep the
 * components.
 */

import { TODO_FIGURE } from './content';

export type CampaignKind = 'seasonal' | 'offer';

export type Campaign = {
  slug: string;
  kind: CampaignKind;
  eyebrow: string;
  title: string;
  body: string;
  figure: string;
  cta: string;
  image: string;
  imageAlt: string;
  /** ISO date the sample offer is written against. Display only. */
  until?: string;
};

export const campaigns: Campaign[] = [
  {
    slug: 'avurudu-edit',
    kind: 'seasonal',
    eyebrow: 'Seasonal',
    title: 'The April light.',
    body: 'New cloth for the weeks when the island dresses up. A short edit — frocks, shirts, and the pieces people ask for first.',
    figure: TODO_FIGURE,
    cta: 'Ask about the April edit',
    image: '/brand/offer-april.webp',
    imageAlt: 'Warm gold and ivory batik-inspired campaign ground.',
    until: '2026-04-20',
  },
  {
    slug: 'first-order',
    kind: 'offer',
    eyebrow: 'For a first conversation',
    title: 'A quieter welcome.',
    body: 'A sample courtesy on a first enquiry — to be replaced by the real figure when the house is ready to keep the promise.',
    figure: `${TODO_FIGURE}%`,
    cta: 'Enquire with this note',
    image: '/brand/offer-loyalty.webp',
    imageAlt: 'Dusty rose campaign ground with sparse floral batik motifs.',
  },
  {
    slug: 'delivery-threshold',
    kind: 'offer',
    eyebrow: 'Delivery',
    title: 'Brought to the door.',
    body: 'Complimentary delivery above a threshold we have not set yet. The panel is ready; the number is not.',
    figure: TODO_FIGURE,
    cta: 'Ask about delivery',
    image: '/brand/offer-delivery.webp',
    imageAlt: 'Deep navy campaign ground with sparse gold batik linework.',
  },
  {
    slug: 'family-order',
    kind: 'offer',
    eyebrow: 'Ordering together',
    title: 'The family order.',
    body: 'A sample courtesy when several pieces travel in the same suitcase — the way most orders actually arrive. The figure is a placeholder.',
    figure: `${TODO_FIGURE}%`,
    cta: 'Ask about ordering together',
    image: '/brand/offer-seasonal.webp',
    imageAlt: 'Warm gold and ivory campaign ground with fine navy batik linework.',
  },
];

export function seasonalCampaigns(): Campaign[] {
  return campaigns.filter((item) => item.kind === 'seasonal');
}

export function offerCampaigns(): Campaign[] {
  return campaigns.filter((item) => item.kind === 'offer');
}
