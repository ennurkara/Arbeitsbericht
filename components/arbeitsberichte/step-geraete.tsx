'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'
import type { Device } from '@/lib/types'
import type { WizardData } from './wizard'

interface StepGeraeteProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepGeraete({ data, onNext }: StepGeraeteProps) {
  const supabase = createClient()
  const [devices, setDevices] = useState<Device[]>([])
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(data.deviceIds)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('devices')
      .select('id, name, serial_number, status, category:categories(name, icon)')
      .eq('status', 'lager')
      .order('name')
      .then(({ data: rows }) => setDevices((rows ?? []) as Device[]))
  }, [])

  const filtered = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.serial_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function toggleDevice(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectedDevices = devices.filter(d => selectedIds.includes(d.id))

  async function handleNext() {
    setIsLoading(true)
    await onNext({ deviceIds: selectedIds })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Installierte Geräte</h2>
      <p className="text-sm text-slate-500">Nur Geräte mit Status „Lager" werden angezeigt.</p>

      {selectedDevices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedDevices.map(d => (
            <Badge key={d.id} variant="secondary" className="flex items-center gap-1 py-1">
              {d.name}
              {d.serial_number && <span className="text-slate-400 text-xs">· {d.serial_number}</span>}
              <button onClick={() => toggleDevice(d.id)} className="ml-1 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Gerät oder Seriennummer suchen..."
          value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Keine Geräte verfügbar</p>
        )}
        {filtered.map(device => (
          <button key={device.id} onClick={() => toggleDevice(device.id)}
            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
              selectedIds.includes(device.id)
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-slate-50 text-slate-700'
            }`}>
            <span className="font-medium">{device.name}</span>
            {device.serial_number && (
              <span className="text-slate-400 ml-2">SN: {device.serial_number}</span>
            )}
            {device.category && (
              <span className="text-xs text-slate-400 ml-2">
                · {(device.category as any).name}
              </span>
            )}
          </button>
        ))}
      </div>

      <Button className="w-full" onClick={handleNext} disabled={isLoading}>
        {selectedIds.length === 0
          ? 'Überspringen →'
          : `Weiter → (${selectedIds.length} Gerät${selectedIds.length !== 1 ? 'e' : ''})`}
      </Button>
    </div>
  )
}