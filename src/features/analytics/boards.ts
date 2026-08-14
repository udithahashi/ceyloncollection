/**
 * The analytics boards, as data.
 *
 * WHY BOARDS AT ALL
 * Leads are the only thing measured today, but they are the smallest part of what this
 * system will measure: stock, spending, income and margin are all coming. The tempting
 * shape is one dashboard that grows a section per subject, and the reliable outcome of
 * that is a page of thirty charts where the important one is below the fold - and where
 * adding a chart means arguing about what to remove.
 *
 * So a board is a subject, and each subject gets its own page: one question per visit.
 * "How is demand?" is a different sitting from "did last month make money?", and they
 * want different periods, different comparisons and different people looking at them.
 *
 * Boards that do not exist yet are listed rather than hidden, the same convention the
 * navigation uses. It shows where a number will live before it exists, which is more use
 * than pretending the tool is finished.
 */
import { Boxes, Coins, ShoppingBag, TrendingUp, type LucideIcon } from 'lucide-react';

import type { Permission } from '@/lib/auth/roles';

export interface Board {
  key: string;
  label: string;
  /** One line: the question this board answers. */
  question: string;
  /** What it will hold, for a board that is not built yet. */
  detail: string;
  icon: LucideIcon;
  /** Present once the board exists. Absent means "planned". */
  href?: '/analytics/demand';
  /** Every board is gated; the page itself checks, this only decides what is shown. */
  permission: Permission;
}

export const boards: readonly Board[] = [
  {
    key: 'demand',
    label: 'Demand',
    question: 'What are people asking for, and through which channel?',
    detail:
      'Enquiries over time, the platforms they arrive on, and the categories, fabrics and sizes being asked for - the evidence behind what goes in the next shipment.',
    icon: TrendingUp,
    href: '/analytics/demand',
    permission: 'analytics:read',
  },
  {
    key: 'money',
    label: 'Money',
    question: 'Did the last shipment make a profit?',
    detail:
      'Income against spending, landed cost per shipment - purchase, freight, customs and delivery - and the margin left after all of it.',
    icon: Coins,
    permission: 'analytics:read',
  },
  {
    key: 'stock',
    label: 'Stock',
    question: 'What is sitting unsold, and what sold out too fast?',
    detail:
      'Stock on hand by category and size, how quickly each line sells, and the gap between what was asked for and what was actually bought.',
    icon: Boxes,
    permission: 'analytics:read',
  },
  {
    key: 'orders',
    label: 'Orders',
    question: 'Which enquiries turned into sales?',
    detail:
      'Conversion from first message to delivery, how long each stage takes, and which channels bring buyers rather than browsers.',
    icon: ShoppingBag,
    permission: 'analytics:read',
  },
];

export const availableBoards = boards.filter(
  (board): board is Board & { href: NonNullable<Board['href']> } => board.href !== undefined
);
