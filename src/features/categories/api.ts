import { apiRequest } from '../../lib/api-client'
import { colorKeys, type ColorKey } from '../../lib/color-keys'

export const categoryDirections = ['expense', 'income'] as const
export const categoryColorKeys = colorKeys
export const categoryIconKeys = [
  'house', 'landmark', 'repeat-2', 'dumbbell', 'cigarette', 'flag',
  'heart-handshake', 'graduation-cap', 'clapperboard', 'gift', 'shirt',
  'smartphone', 'heart-pulse', 'shopping-basket', 'plane', 'party-popper',
  'tram-front', 'receipt-text', 'utensils', 'briefcase-business', 'car-front',
  'ellipsis', 'banknote-arrow-up', 'rotate-ccw', 'circle-plus', 'hand-coins',
  'tags', 'wallet-cards', 'bed-double', 'building-2', 'key-round', 'wifi',
  'flame', 'lightbulb', 'droplets', 'tv', 'music-2', 'gamepad-2', 'book-open',
  'laptop', 'camera', 'coffee', 'pizza', 'beer', 'martini', 'bus-front',
  'train-front', 'bike', 'fuel', 'wrench', 'shopping-cart', 'store',
  'credit-card', 'piggy-bank', 'chart-no-axes-combined', 'badge-dollar-sign',
  'circle-dollar-sign', 'receipt', 'hospital', 'pill', 'stethoscope', 'baby',
  'users-round', 'heart', 'handshake', 'phone', 'package', 'hotel',
  'alarm-clock', 'archive', 'armchair', 'bath', 'bell-ring', 'bolt',
  'calendar-days', 'chart-pie', 'chef-hat', 'circle-gauge', 'clipboard-list',
  'cloud-sun', 'coins', 'cooking-pot', 'crown', 'disc-3', 'door-open',
  'drama', 'file-text', 'footprints', 'globe-2', 'hammer', 'headphones',
  'ice-cream-bowl', 'leaf', 'monitor', 'mountain', 'paintbrush', 'palmtree',
  'popcorn', 'radio', 'sailboat', 'scissors', 'ship', 'shower-head', 'soup',
  'square-parking', 'tent-tree', 'ticket', 'trophy', 'umbrella', 'unplug',
  'utility-pole', 'washing-machine', 'waves', 'wine',
] as const

export type CategoryDirection = (typeof categoryDirections)[number]
export type CategoryColorKey = ColorKey
export type CategoryIconKey = (typeof categoryIconKeys)[number]

export type Category = {
  id: string
  name: string
  direction: CategoryDirection
  iconKey: CategoryIconKey
  colorKey: CategoryColorKey
  sortOrder: number
}

export type CreateCategoryInput = Pick<Category, 'name' | 'direction' | 'iconKey' | 'colorKey'>
export type UpdateCategoryInput = Pick<Category, 'name' | 'iconKey' | 'colorKey'>

export async function listCategories() {
  return apiRequest<{ items: Category[] }>('/categories')
}

export async function createCategory(input: CreateCategoryInput) {
  return apiRequest<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  return apiRequest<Category>(`/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function reorderCategories(direction: CategoryDirection, categoryIds: string[]) {
  await apiRequest<void>(`/categories/${direction}/order`, {
    method: 'PUT',
    body: JSON.stringify({ categoryIds }),
  })
}

export async function deleteCategory(categoryId: string) {
  await apiRequest<void>(`/categories/${categoryId}`, { method: 'DELETE' })
}
