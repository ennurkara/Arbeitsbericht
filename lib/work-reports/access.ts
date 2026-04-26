import type { SupabaseClient } from '@supabase/supabase-js'

export interface AccessContext {
  user: { id: string }
  role: 'admin' | 'mitarbeiter' | 'techniker' | 'viewer' | null
}

/** Holt den eingeloggten User + seine Rolle aus profiles. Returns null
 *  wenn nicht angemeldet (Caller muss 401 antworten). */
export async function getAccessContext(supabase: SupabaseClient): Promise<AccessContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return { user: { id: user.id }, role: (profile?.role ?? null) as AccessContext['role'] }
}

/** Spiegelt die SELECT-RLS-Policy aus Migration 016: Techniker sehen
 *  eigene Berichte; admin + viewer sehen alle. */
export function canAccessReport(ctx: AccessContext, technicianId: string): boolean {
  if (ctx.role === 'admin' || ctx.role === 'viewer') return true
  return technicianId === ctx.user.id
}
