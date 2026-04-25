'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, X, Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn, deviceDisplayName } from '@/lib/utils'
import type { Device } from '@/lib/types'
import type { WizardData } from './wizard'

interface StepGeraeteProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

const DEVICE_SELECT = `
  id,
  serial_number,
  status,
  model:models(
    modellname,
    variante,
    manufacturer:manufacturers(name),
    category:categories(name, icon)
  )
`

/** Liest eine File als base64 (ohne den `data:image/...;base64,`-Prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') return reject(new Error('Lesefehler'))
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader-Fehler'))
    reader.readAsDataURL(file)
  })
}

/** Normalisiert Seriennummern für Matching: lowercase, ohne Whitespace + Sonderzeichen. */
function normalizeSerial(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/.:]/g, '')
}

export function StepGeraete({ data, onNext }: StepGeraeteProps) {
  const supabase = createClient()
  const [devices, setDevices] = useState<Device[]>([])
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(data.deviceIds)
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('devices')
      .select(DEVICE_SELECT)
      .eq('status', 'lager')
      .order('serial_number', { nullsFirst: false })
      .then(({ data: rows }) => {
        const list = ((rows ?? []) as unknown as Device[]).slice()
        list.sort((a, b) =>
          deviceDisplayName(a.model).localeCompare(deviceDisplayName(b.model))
        )
        setDevices(list)
      })
  }, [])

  const filtered = devices.filter(d => {
    const needle = search.toLowerCase()
    return (
      deviceDisplayName(d.model).toLowerCase().includes(needle) ||
      (d.serial_number ?? '').toLowerCase().includes(needle)
    )
  })

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

  async function handleScanFile(file: File) {
    setIsScanning(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/ocr-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const serials: string[] = Array.isArray(json.serials) ? json.serials : []
      if (serials.length === 0) {
        toast.error('Keine Seriennummer erkannt', {
          description: 'Versuche es mit einem schärferen Foto vom Typenschild.',
        })
        return
      }

      // Match gegen die geladene Lager-Liste (normalisiert).
      const normSerials = serials.map(normalizeSerial)
      const matches = devices.filter(d => {
        if (!d.serial_number) return false
        const dn = normalizeSerial(d.serial_number)
        return normSerials.some(s => s === dn || s.includes(dn) || dn.includes(s))
      })

      if (matches.length === 0) {
        toast.error('Kein Gerät im Lager gefunden', {
          description: `Erkannt: ${serials.join(', ')}`,
        })
        return
      }

      // Auto-select alle Treffer (typischerweise einer)
      setSelectedIds(prev => {
        const set = new Set(prev)
        for (const m of matches) set.add(m.id)
        return Array.from(set)
      })

      const names = matches.map(m => deviceDisplayName(m.model)).join(', ')
      toast.success(
        matches.length === 1
          ? `Gerät erkannt: ${names}`
          : `${matches.length} Geräte erkannt: ${names}`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Scan fehlgeschlagen', { description: msg })
    } finally {
      setIsScanning(false)
      // Input zurücksetzen, damit dasselbe File bei Bedarf nochmal getriggert werden kann
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Installierte Geräte</h2>
        <p className="text-[12.5px] text-[var(--ink-3)] mt-1">Nur Geräte mit Status „Lager" werden angezeigt.</p>
      </div>

      {selectedDevices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedDevices.map(d => (
            <Badge key={d.id} variant="verkauft" className="flex items-center gap-1.5 py-1 pr-1">
              <span>{deviceDisplayName(d.model)}</span>
              {d.serial_number && <span className="text-[var(--ink-4)] text-[10.5px]">· {d.serial_number}</span>}
              <button
                onClick={() => toggleDevice(d.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/40 transition-colors"
                aria-label="Entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-4)]" />
          <Input placeholder="Gerät oder Seriennummer suchen..."
            value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          aria-label="Gerät per Foto scannen"
          title="Gerät per Foto scannen"
          className="shrink-0"
        >
          {isScanning
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Camera className="h-4 w-4" />}
          <span className="hidden sm:inline ml-1.5 text-[12.5px]">Scannen</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void handleScanFile(f)
          }}
        />
      </div>

      <div className="max-h-56 overflow-y-auto border border-[var(--rule)] rounded-md bg-white kb-scroll">
        {filtered.length === 0 && (
          <p className="text-[13px] text-[var(--ink-3)] text-center py-4">Keine Geräte verfügbar</p>
        )}
        {filtered.map((device, i) => (
          <button
            key={device.id}
            onClick={() => toggleDevice(device.id)}
            className={cn(
              'w-full text-left px-4 py-3 text-[13px] transition-colors',
              i > 0 && 'border-t border-[var(--rule-soft)]',
              selectedIds.includes(device.id)
                ? 'bg-[var(--blue-tint)] text-[var(--blue-ink)]'
                : 'hover:bg-[var(--paper-2)] text-[var(--ink-2)]'
            )}
          >
            <span className="font-medium">{deviceDisplayName(device.model)}</span>
            {device.serial_number && (
              <span className="text-[var(--ink-4)] ml-2">SN: {device.serial_number}</span>
            )}
            {device.model?.category && (
              <span className="text-[11.5px] text-[var(--ink-4)] ml-2">
                · {device.model.category.name}
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
