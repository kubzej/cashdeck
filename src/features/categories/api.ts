import { apiRequest } from '../../lib/api-client'
import { colorKeys, type ColorKey } from '../../lib/color-keys'
import { categoryIconKeys, type CategoryIconKey } from '../../../server/src/management/category-catalog'

export const categoryDirections = ['expense', 'income'] as const
export const categoryColorKeys = colorKeys
export { categoryIconKeys }

export type CategoryDirection = (typeof categoryDirections)[number]
export type CategoryColorKey = ColorKey
export type { CategoryIconKey }

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
