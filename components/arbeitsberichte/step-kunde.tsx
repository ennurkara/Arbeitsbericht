'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Search, UserPlus } from 'lucide-react'
import type { Customer } from '@/lib/types'
import type { WizardData } from './wizard'

interface StepKundeProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepKunde({ data, onNext }: StepKundeProps) {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(data.customerId)
  const [showNewForm, setShowNewForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', address: '', phone: '', email: '' })

  useEffect(() => {
    supabase.from('customers').select('*').order('name')
      .then(({ data: rows }) => setCustomers(rows ?? []))
  }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreateCustomer() {
    if (!newCustomer.name.trim()) {
      toast.error('Name ist erforderlich')
      return
    }
    setIsLoading(true)
    const payload = {
      name: newCustomer.name.trim(),
      address: newCustomer.address || null,
      phone: newCustomer.phone || null,
      email: newCustomer.email || null,
    }
    const { data: created, error } = await supabase
      .from('customers')
      .insert(payload)
      .select()
      .single()

    if (error || !created) {
      toast.error('Kunde konnte nicht gespeichert werden')
      setIsLoading(false)
      return
    }
    setCustomers(prev =>
      [...prev, created as Customer].sort((a, b) => a.name.localeCompare(b.name))
    )
    setSelectedId(created.id)
    setShowNewForm(false)
    setNewCustomer({ name: '', address: '', phone: '', email: '' })
    setIsLoading(false)
    toast.success('Kunde gespeichert')
  }

  async function handleNext() {
    if (!selectedId) {
      toast.error('Bitte einen Kunden auswählen')
      return
    }
    setIsLoading(true)
    await onNext({ customerId: selectedId })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Kundendaten</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Kunde suchen..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Keine Kunden gefunden</p>
        )}
        {filtered.map(customer => (
          <button key={customer.id} onClick={() => setSelectedId(customer.id)}
            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
              selectedId === customer.id
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'hover:bg-slate-50 text-slate-700'
            }`}>
            <span className="font-medium">{customer.name}</span>
            {customer.address && <span className="text-slate-400 ml-2">· {customer.address}</span>}
          </button>
        ))}
      </div>

      {!showNewForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)}>
          <UserPlus className="h-4 w-4 mr-2" />Neuen Kunden anlegen
        </Button>
      ) : (
        <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Neuer Kunde</h3>
          <div>
            <Label htmlFor="cname">Name *</Label>
            <Input id="cname" value={newCustomer.name}
              onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="caddress">Adresse</Label>
            <Input id="caddress" value={newCustomer.address}
              onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))}
              placeholder="Straße + Nr., PLZ Ort" />
          </div>
          <div>
            <Label htmlFor="cphone">Telefon</Label>
            <Input id="cphone" value={newCustomer.phone}
              onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cemail">E-Mail</Label>
            <Input id="cemail" type="email" value={newCustomer.email}
              onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateCustomer} disabled={isLoading}>Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      <Button className="w-full" onClick={handleNext} disabled={isLoading || !selectedId}>
        Weiter →
      </Button>
    </div>
  )
}