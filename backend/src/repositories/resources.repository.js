import { repository, RepositoryError } from './base.repository.js'

const categories = repository('resource_categories')
const resources = repository('resources')
const files = repository('resource_files')

export async function listCategories() {
  const result = await categories.list({ select: '*', order: { column: 'name' }, page: 1, pageSize: 100 })
  const rows = await Promise.all(result.rows.map(async (row) => {
    const count = await resources.list({ select: 'id', filters: [{ type: 'eq', column: 'category_id', value: row.id }], page: 1, pageSize: 1 })
    return { ...row, resource_count: count.total ?? count.rows.length }
  }))
  return rows
}

export async function listResources({ categoryId, page = 1, pageSize = 50, sort = 'newest' } = {}) {
  const filters = categoryId ? [{ type: 'eq', column: 'category_id', value: categoryId }] : []
  return resources.list({
    select: '*, resource_categories(id,name), resource_files(*)',
    filters,
    order: { column: 'created_at', ascending: sort === 'oldest' },
    page,
    pageSize,
  })
}

export async function getResource(id) {
  return resources.get({ select: '*, resource_categories(id,name), resource_files(*)', filters: [{ type: 'eq', column: 'id', value: id }], single: true })
}

export async function getResourceId(id) {
  return resources.get({ select: 'id', filters: [{ type: 'eq', column: 'id', value: id }], single: true })
}

export async function createCategory(row) { return categories.insert(row) }
export async function updateCategory(id, row) { return categories.update(row, { filters: [{ type: 'eq', column: 'id', value: id }] }) }
export async function deleteCategory(id) { return categories.remove({ filters: [{ type: 'eq', column: 'id', value: id }] }) }
export async function createResource(row) { return resources.insert(row) }
export async function updateResource(id, row) { return resources.update(row, { filters: [{ type: 'eq', column: 'id', value: id }] }) }
export async function deleteResource(id) { return resources.remove({ filters: [{ type: 'eq', column: 'id', value: id }] }) }

export async function listResourceFiles(resourceId) {
  return files.get({ select: 'file_path', filters: [{ type: 'eq', column: 'resource_id', value: resourceId }] })
}

export async function listFileTypes(resourceId) {
  return files.get({ select: 'file_type', filters: [{ type: 'eq', column: 'resource_id', value: resourceId }] })
}

export async function getFile(id) {
  return files.get({ select: '*', filters: [{ type: 'eq', column: 'id', value: id }], single: true })
}

export async function createFile(row) {
  try {
    return await files.insert(row)
  } catch (error) {
    if (error instanceof RepositoryError && error.cause?.code === '23505') return null
    throw error
  }
}
export async function deleteFile(id) { return files.remove({ filters: [{ type: 'eq', column: 'id', value: id }] }) }
