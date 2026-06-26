import { supabase, isBackendEnabled } from './supabase'

// Cloud sync for the app's records. Model: localStorage is the offline working
// copy; the cloud is a continuous backup that can restore onto a new/wiped
// device and carry records between devices. Pushes are fire-and-forget and skip
// when offline (they re-run on the next change once back online).

let owner = null // { userId, orgId } — fetched once per session

export async function loadOwner() {
  if (!isBackendEnabled) return null
  if (owner) return owner
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single()
  owner = { userId: user.id, orgId: profile?.org_id || null }
  return owner
}

export function clearOwner() { owner = null }

// Upsert a collection of local items (each with an `id`) to a table. `promote`
// maps an item to any extra column values (e.g. a sortable date).
export async function pushItems(table, items, promote = () => ({})) {
  if (!isBackendEnabled || !items?.length) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const o = await loadOwner()
  if (!o) return
  const rows = items
    .filter(it => it && it.id)
    .map(it => ({ user_id: o.userId, org_id: o.orgId, client_id: it.id, data: it, ...promote(it) }))
  if (!rows.length) return
  try {
    await supabase.from(table).upsert(rows, { onConflict: 'user_id,client_id' })
  } catch (_) { /* offline / transient — will re-sync on next change */ }
}

// Pull all of the user's rows for a table, newest first, as plain item objects.
export async function pullItems(table) {
  if (!isBackendEnabled) return []
  const o = await loadOwner()
  if (!o) return []
  try {
    const { data, error } = await supabase
      .from(table).select('data').order('updated_at', { ascending: false })
    if (error) return []
    return (data || []).map(r => r.data).filter(Boolean)
  } catch (_) { return [] }
}

// Union two collections by `id`, adding cloud items not already present locally.
// Local copies win (never overwritten) — avoids clobbering unsynced edits.
export function mergeById(local, cloud) {
  const ids = new Set((local || []).map(x => x && x.id))
  const additions = (cloud || []).filter(x => x && x.id && !ids.has(x.id))
  return additions.length ? [...local, ...additions] : local
}
