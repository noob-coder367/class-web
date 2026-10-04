import { supabaseAdmin } from '../config/supabaseClient.js'

export class RepositoryError extends Error {
  constructor(message, { table, operation, cause } = {}) {
    super(message, { cause })
    this.name = 'RepositoryError'
    this.status = 503
    this.table = table
    this.operation = operation
    this.cause = cause
  }
}

function throwDatabaseError(error, context) {
  if (!error) return
  const detail = error.message || 'unknown database error'
  console.error(`[repository] ${context.operation} ${context.table} failed: ${detail}`, {
    code: error.code,
    details: error.details,
    hint: error.hint,
  })
  throw new RepositoryError(`Database operation failed: ${context.operation} ${context.table}`, {
    ...context,
    cause: error,
  })
}

export function repository(table) {
  const run = async (operation, query) => {
    const result = await query
    throwDatabaseError(result.error, { table, operation })
    return result
  }

  return {
    table,
    async list({ select = '*', filters = [], order, page = 1, pageSize = 50, count = 'exact' } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
      const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 50))
      let query = supabaseAdmin.from(table).select(select, { count })
      for (const filter of filters) {
        if (filter?.type === 'eq') query = query.eq(filter.column, filter.value)
        if (filter?.type === 'is') query = query.is(filter.column, filter.value)
        if (filter?.type === 'ilike') query = query.ilike(filter.column, filter.value)
        if (filter?.type === 'or') query = query.or(filter.value)
      }
      if (order?.column) query = query.order(order.column, { ascending: order.ascending !== false })
      const from = (safePage - 1) * safePageSize
      const result = await run('list', query.range(from, from + safePageSize - 1))
      const total = Number.isFinite(result.count) ? result.count : null
      return {
        rows: result.data || [],
        page: safePage,
        pageSize: safePageSize,
        total,
        hasMore: total === null ? (result.data || []).length === safePageSize : from + (result.data || []).length < total,
      }
    },
    async get({ select = '*', filters = [], single = false } = {}) {
      let query = supabaseAdmin.from(table).select(select)
      for (const filter of filters) {
        if (filter?.type === 'eq') query = query.eq(filter.column, filter.value)
        if (filter?.type === 'is') query = query.is(filter.column, filter.value)
      }
      const result = await run('get', single ? query.maybeSingle() : query)
      return single ? result.data || null : result.data || []
    },
    async insert(values, { select = '*' } = {}) {
      const result = await run('insert', supabaseAdmin.from(table).insert(values).select(select).single())
      return result.data
    },
    async update(values, { filters = [], select = '*' } = {}) {
      let query = supabaseAdmin.from(table).update(values)
      for (const filter of filters) {
        if (filter?.type === 'eq') query = query.eq(filter.column, filter.value)
      }
      const result = await run('update', query.select(select).single())
      return result.data
    },
    async remove({ filters = [] } = {}) {
      let query = supabaseAdmin.from(table).delete()
      for (const filter of filters) {
        if (filter?.type === 'eq') query = query.eq(filter.column, filter.value)
      }
      await run('delete', query)
    },
  }
}
