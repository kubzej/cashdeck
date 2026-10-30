// Single source of truth for every list of allowed values and every limit that the server and
// the frontend must agree on. The frontend imports this file directly (see the `api.ts` files);
// the server's domain modules import it too. Nothing in this file may be declared a second time
// anywhere else (`catalog.test.ts` checks that).
//
// Conventions: lists are plural camelCase in display order, each with a type derived from it;
// scalar limits are MAX_* in SCREAMING_SNAKE. Values used by only one side stay next to the code
// that uses them.

// ── Enumerations ─────────────────────────────────────────────────────────────

export const categoryIconKeys = [
  'house',
  'landmark',
  'repeat-2',
  'dumbbell',
  'cigarette',
  'flag',
  'heart-handshake',
  'graduation-cap',
  'clapperboard',
  'gift',
  'shirt',
  'smartphone',
  'heart-pulse',
  'shopping-basket',
  'plane',
  'party-popper',
  'tram-front',
  'receipt-text',
  'utensils',
  'briefcase-business',
  'car-front',
  'car',
  'ellipsis',
  'banknote-arrow-up',
  'rotate-ccw',
  'circle-plus',
  'hand-coins',
  'tags',
  'wallet-cards',
  'bed-double',
  'building-2',
  'key-round',
  'wifi',
  'flame',
  'lightbulb',
  'droplets',
  'tv',
  'music-2',
  'gamepad-2',
  'book-open',
  'laptop',
  'camera',
  'coffee',
  'pizza',
  'beer',
  'martini',
  'bus-front',
  'train-front',
  'bike',
  'fuel',
  'wrench',
  'shopping-cart',
  'store',
  'credit-card',
  'piggy-bank',
  'chart-no-axes-combined',
  'badge-dollar-sign',
  'circle-dollar-sign',
  'receipt',
  'hospital',
  'pill',
  'stethoscope',
  'baby',
  'users-round',
  'heart',
  'handshake',
  'phone',
  'package',
  'hotel',
  'alarm-clock',
  'archive',
  'armchair',
  'bath',
  'bell-ring',
  'bolt',
  'calendar-days',
  'chart-pie',
  'chef-hat',
  'circle-gauge',
  'clipboard-list',
  'cloud-sun',
  'coins',
  'cooking-pot',
  'crown',
  'disc-3',
  'door-open',
  'drama',
  'file-text',
  'footprints',
  'globe-2',
  'hammer',
  'headphones',
  'ice-cream-bowl',
  'leaf',
  'monitor',
  'mountain',
  'paintbrush',
  'palmtree',
  'popcorn',
  'radio',
  'sailboat',
  'scissors',
  'ship',
  'shower-head',
  'soup',
  'square-parking',
  'tent-tree',
  'ticket',
  'trophy',
  'umbrella',
  'unplug',
  'utility-pole',
  'washing-machine',
  'waves',
  'wine',
] as const

export type CategoryIconKey = (typeof categoryIconKeys)[number]

export const categoryDirections = ['expense', 'income'] as const
export type CategoryDirection = (typeof categoryDirections)[number]

export const colorKeys = [
  'slate-light',
  'slate',
  'slate-dark',
  'gray-light',
  'gray',
  'gray-dark',
  'red-light',
  'red',
  'red-dark',
  'orange-light',
  'orange',
  'orange-dark',
  'yellow-light',
  'yellow',
  'yellow-dark',
  'amber-light',
  'amber',
  'amber-dark',
  'lime-light',
  'lime',
  'lime-dark',
  'green-light',
  'green',
  'green-dark',
  'teal-light',
  'teal',
  'teal-dark',
  'cyan-light',
  'cyan',
  'cyan-dark',
  'sky-light',
  'sky',
  'sky-dark',
  'blue-light',
  'blue',
  'blue-dark',
  'indigo-light',
  'indigo',
  'indigo-dark',
  'violet-light',
  'violet',
  'violet-dark',
  'pink-light',
  'pink',
  'pink-dark',
  'rose-light',
  'rose',
  'rose-dark',
  'brown-light',
  'brown',
  'brown-dark',
] as const
export type ColorKey = (typeof colorKeys)[number]

export const walletTypes = ['cash', 'checking', 'savings', 'investment', 'pension', 'crypto', 'other'] as const
export type WalletType = (typeof walletTypes)[number]

export const recurringRuleKinds = ['transaction', 'transfer'] as const
export type RecurringRuleKind = (typeof recurringRuleKinds)[number]

// What a row of the combined activity feed can be.
export const feedItemKinds = ['transaction', 'transfer', 'balance_adjustment'] as const
export type FeedItemKind = (typeof feedItemKinds)[number]

export const recurringFrequencies = [
  'daily', 'weekly', 'biweekly', 'monthly', 'every_two_months',
  'every_three_months', 'semiannual', 'yearly', 'custom_days',
] as const
export type RecurringFrequency = (typeof recurringFrequencies)[number]

// The period filter shared by the feed, the planned view and the overview.
export const feedPeriods = ['week', 'month', 'year', 'all', 'custom'] as const
export type FeedPeriod = (typeof feedPeriods)[number]

export const overviewGranularities = ['day', 'month', 'quarter'] as const
export type OverviewGranularity = (typeof overviewGranularities)[number]

// 'total' means no category/label filter at all: the current wallets, date range and search.
export const overviewSelectionTypes = ['category', 'label', 'total'] as const
export type OverviewSelectionType = (typeof overviewSelectionTypes)[number]

// ── Limits ───────────────────────────────────────────────────────────────────

// Far above any personal amount and far enough below 2^53 that sums of stored amounts stay
// exact in JS numbers; mostly a guard against typos (an extra run of zeros).
export const MAX_AMOUNT_CZK = 10_000_000_000
export const MAX_NOTE_LENGTH = 2000
export const MAX_NAME_LENGTH = 120
