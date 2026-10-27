// Load and save company registers. The caller is an org member; row level
// security stamps and limits every row to that organisation.

function registerPayload(base) {
  return {
    id: base.id,
    name: base.name,
    abbr: base.abbr || '',
    color: base.color || '#8eb4ff',
    starred: Boolean(base.starred),
    kind: base.kind || 'base',
    opened_at: base.openedAt || new Date().toISOString(),
  }
}

const pendingSeeds = new Map()

function isDuplicate(err) {
  const message = `${err?.code || ''} ${err?.message || ''}`
  return message.includes('23505') || /duplicate key/i.test(message)
}

export function resetSeedLock() {
  pendingSeeds.clear()
}

export function seedBases(supabase, userKey = '') {
  const key = `${supabase?.supabaseUrl || 'remote'}:${userKey}`
  if (!pendingSeeds.has(key)) {
    const job = (async () => {
      let list = await pullBases(supabase)
      const { missingStarters } = await import('./registers.js')
      const missing = missingStarters(list)
      if (!missing.length) return list
      try {
        await pushBases(supabase, missing)
      } catch (err) {
        if (!isDuplicate(err)) throw err
      }
      return pullBases(supabase)
    })()
    pendingSeeds.set(key, job)
    job.catch(() => { pendingSeeds.delete(key) })
  }
  return pendingSeeds.get(key)
}

export async function pullBases(supabase) {
  const [registers, tables, fields, views, rows] = await Promise.all([
    supabase.from('registers').select('id,name,abbr,color,starred,kind,opened_at'),
    supabase.from('register_tables').select('id,register_id,name,position'),
    supabase.from('register_fields').select('id,table_id,name,field_type,options,position'),
    supabase.from('register_views').select('id,table_id,name,config,position'),
    supabase.from('register_rows').select('id,table_id,values,created_at,updated_at'),
  ])
  const error = registers.error || tables.error || fields.error || views.error || rows.error
  if (error) throw error
  return (registers.data || []).map((reg) => ({
    id: reg.id,
    name: reg.name,
    abbr: reg.abbr,
    color: reg.color,
    starred: reg.starred,
    kind: reg.kind,
    openedAt: reg.opened_at,
    virtual: false,
    tables: (tables.data || [])
      .filter((table) => table.register_id === reg.id)
      .sort((a, b) => a.position - b.position)
      .map((table) => ({
        id: table.id,
        name: table.name,
        position: table.position,
        fields: (fields.data || [])
          .filter((item) => item.table_id === table.id)
          .sort((a, b) => a.position - b.position)
          .map((item) => ({
            id: item.id,
            name: item.name,
            type: item.field_type,
            options: item.options || [],
            position: item.position,
          })),
        views: (views.data || [])
          .filter((item) => item.table_id === table.id)
          .sort((a, b) => a.position - b.position)
          .map((item) => ({
            id: item.id,
            name: item.name,
            position: item.position,
            config: item.config || {},
          })),
        rows: (rows.data || [])
          .filter((item) => item.table_id === table.id)
          .map((item) => ({
            id: item.id,
            values: item.values || {},
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          })),
      })),
  }))
}

async function insertChildren(supabase, base) {
  for (const table of base.tables || []) {
    const { error } = await supabase.from('register_tables').insert({
      id: table.id,
      register_id: base.id,
      name: table.name,
      position: table.position || 0,
    })
    if (error) throw error
    if (table.fields?.length) {
      const { error: fieldError } = await supabase.from('register_fields').insert(table.fields.map((item) => ({
        id: item.id,
        table_id: table.id,
        name: item.name,
        field_type: item.type,
        options: item.options || [],
        position: item.position || 0,
      })))
      if (fieldError) throw fieldError
    }
    if (table.views?.length) {
      const { error: viewError } = await supabase.from('register_views').insert(table.views.map((item) => ({
        id: item.id,
        table_id: table.id,
        name: item.name,
        config: item.config || {},
        position: item.position || 0,
      })))
      if (viewError) throw viewError
    }
    if (table.rows?.length) {
      const { error: rowError } = await supabase.from('register_rows').insert(table.rows.map((item) => ({
        id: item.id,
        table_id: table.id,
        values: item.values || {},
      })))
      if (rowError) throw rowError
    }
  }
}

export async function pushBases(supabase, bases) {
  for (const base of bases || []) {
    const { error } = await supabase.from('registers').insert(registerPayload(base))
    if (error) {
      if (error.code === '23505') continue
      throw error
    }
    try {
      await insertChildren(supabase, base)
    } catch (err) {
      await supabase.from('registers').delete().eq('id', base.id)
      throw err
    }
  }
}

export async function pushRegisterPatch(supabase, id, patch) {
  const row = {}
  if (patch.name != null) row.name = patch.name
  if (patch.abbr != null) row.abbr = patch.abbr
  if (patch.color != null) row.color = patch.color
  if (patch.starred != null) row.starred = patch.starred
  if (patch.openedAt != null) row.opened_at = patch.openedAt
  const { error } = await supabase.from('registers').update(row).eq('id', id)
  if (error) throw error
}

export async function pushTable(supabase, registerId, table) {
  const { error } = await supabase.from('register_tables').insert({
    id: table.id,
    register_id: registerId,
    name: table.name,
    position: table.position || 0,
  })
  if (error) throw error
  if (table.fields?.length) {
    const { error: fieldError } = await supabase.from('register_fields').insert(table.fields.map((item) => ({
      id: item.id,
      table_id: table.id,
      name: item.name,
      field_type: item.type,
      options: item.options || [],
      position: item.position || 0,
    })))
    if (fieldError) throw fieldError
  }
  if (table.views?.length) {
    const { error: viewError } = await supabase.from('register_views').insert(table.views.map((item) => ({
      id: item.id,
      table_id: table.id,
      name: item.name,
      config: item.config || {},
      position: item.position || 0,
    })))
    if (viewError) throw viewError
  }
}

export async function pushField(supabase, tableId, item, position) {
  const { error } = await supabase.from('register_fields').insert({
    id: item.id,
    table_id: tableId,
    name: item.name,
    field_type: item.type,
    options: item.options || [],
    position,
  })
  if (error) throw error
}

export async function pushView(supabase, tableId, item) {
  const { error } = await supabase.from('register_views').upsert({
    id: item.id,
    table_id: tableId,
    name: item.name,
    config: item.config || {},
    position: item.position || 0,
  })
  if (error) throw error
}

export async function pushRow(supabase, tableId, item) {
  const { error } = await supabase.from('register_rows').upsert({
    id: item.id,
    table_id: tableId,
    values: item.values || {},
  })
  if (error) throw error
}

export async function removeRow(supabase, id) {
  const { error } = await supabase.from('register_rows').delete().eq('id', id)
  if (error) throw error
}

export async function removeExampleRows(supabase) {
  const { error } = await supabase.from('register_rows').delete().contains('values', { _example: true })
  if (error) throw error
}
