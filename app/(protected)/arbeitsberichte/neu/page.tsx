import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wizard } from '@/components/arbeitsberichte/wizard'
import type { Profile, UserRole } from '@/lib/types'

export default async function NeuerBerichtPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const role = profile?.role as UserRole

  if (role === 'viewer') redirect('/arbeitsberichte')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Neuer Arbeitsbericht</h1>
      <Wizard profile={profile as Profile} />
    </div>
  )
}