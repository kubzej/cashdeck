import { apiRequest } from '../../lib/api-client'
import { categoryDirections, categoryIconKeys, colorKeys, type CategoryDirection, type CategoryIconKey, type ColorKey } from '../../../server/src/catalog'

export const categoryColorKeys = colorKeys
export { categoryDirections, categoryIconKeys, type CategoryDirection }

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
