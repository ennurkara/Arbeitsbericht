'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn, deviceDisplayName } from '@/lib/utils'
import type { Device } from '@/lib/types'
import type { WizardData, AssignmentKind, DeviceAssignmentChoice } from './wizard'

interface StepGeraeteProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

const DEVICE_SELECT = `
  id,
  serial_number,
  status,
  current_customer_id,
  model:models(
    modellname,
    variante,
    manufacturer:manufacturers(name),
    category:categories(name, icon)
  )
`

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

function normalizeSerial(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/.:]/g, '')
}

const KIND_LABELS: Record<AssignmentKind, string> = {
  leihe: 'Leihe',
  verkauf: 'Installation',
  austausch: 'Austausch',
}

const TSE_CATEGORY = 'TSE Swissbit'
const KASSE_CATEGORY = 'Kassenhardware'

function isTse(d: Pick<Device, 'model'>): boolean {
  return d.model?.category?.name === TSE_CATEGORY
}
function isKasse(d: Pick<Device, 'model'>): boolean {
  return d.model?.category?.name === KASSE_CATEGORY
}

export function StepGeraete({ data, onNext }: StepGeraeteProps) {
  const supabase = createClient()
  const [stockDevices, setStockDevices] = useState<Device[]>([])
  /** Aktuell beim Wizard-Kunden verliehene Geräte — Swap-In-Kandidaten. */
  const [customerDevices, setCustomerDevices] = useState<Device[]>([])
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(data.deviceIds)
  const [assignments, setAssignments] = useState<Record<string, DeviceAssignmentChoice>>(
    data.deviceAssignments,
  )
  const [tseTargets, setTseTargets] = useState<Record<string, string | null>>(
    data.tseInstallTargets ?? {},
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Lager-Geräte: Kandidaten für die Selektion
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
        setStockDevices(list)
      })
  }, [])

  // Beim aktuellen Kunden verliehene Geräte → Austausch-Rückläufer-Liste
  useEffect(() => {
    if (!data.customerId) {
      setCustomerDevices([])
      return
    }
    supabase
      .from('devices')
      .select(DEVICE_SELECT)
      .eq('current_customer_id', data.customerId)
      // verkauft + verliehen + im_einsatz (Legacy) — alle drei können
      // als Tausch-Rückläufer in Frage kommen.
      .in('status', ['verliehen', 'im_einsatz', 'verkauft'])
      .then(({ data: rows }) => {
        setCustomerDevices(((rows ?? []) as unknown as Device[]))
      })
  }, [data.customerId])

  const filtered = stockDevices.filter(d => {
    const needle = search.toLowerCase()
    return (
      deviceDisplayName(d.model).toLowerCase().includes(needle) ||
      (d.serial_number ?? '').toLowerCase().includes(needle)
    )
  })

  function toggleDevice(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        // Auswahl entfernen → Assignment-Choice + TSE-Target säubern
        setAssignments(a => {
          const next = { ...a }
          delete next[id]
          return next
        })
        setTseTargets(t => {
          const next = { ...t }
          delete next[id]
          return next
        })
        return prev.filter(x => x !== id)
      }
      // Default-Aktion = Installation (DB-kind 'verkauf') für alle Geräte;
      // TSE-Devices behalten diesen Default ohnehin als einzige Option.
      const dev = stockDevices.find(d => d.id === id)
      setAssignments(a => ({ ...a, [id]: { kind: 'verkauf', swapInDeviceId: null } }))
      if (dev && isTse(dev)) {
        setTseTargets(t => ({ ...t, [id]: null }))
      }
      return [...prev, id]
    })
  }

  function setKind(deviceId: string, kind: AssignmentKind) {
    setAssignments(a => ({
      ...a,
      [deviceId]: {
        kind,
        // Beim Wechsel weg von Austausch: swap-in zurücksetzen
        swapInDeviceId: kind === 'austausch' ? a[deviceId]?.swapInDeviceId ?? null : null,
      },
    }))
  }

  function setSwapIn(deviceId: string, swapInDeviceId: string | null) {
    setAssignments(a => ({
      ...a,
      [deviceId]: { kind: a[deviceId]?.kind ?? 'austausch', swapInDeviceId },
    }))
  }

  const selectedDevices = stockDevices.filter(d => selectedIds.includes(d.id))

  // Kassen-Kandidaten für TSE-Installation: alle Kassen beim Kunden +
  // alle Kassen, die in diesem AB gerade selektiert sind (gleichzeitige
  // Neuinstallation Kasse + TSE).
  const kassenForTseInstall: Device[] = [
    ...customerDevices.filter(isKasse),
    ...selectedDevices.filter(isKasse),
  ]

  function setTseTarget(tseId: string, kasseId: string | null) {
    setTseTargets(t => ({ ...t, [tseId]: kasseId }))
  }

  async function handleNext() {
    // Validierung: Austausch braucht swap-in
    for (const id of selectedIds) {
      const choice = assignments[id]
      if (choice?.kind === 'austausch' && !choice.swapInDeviceId) {
        toast.error('Austausch unvollständig', {
          description: 'Bitte das zurückkommende Gerät wählen.',
        })
        return
      }
    }
    // Validierung: TSE braucht Ziel-Kasse, sonst nur Status-Update ohne Kopplung.
    // Hinweis als Warning, nicht Block — User soll trotzdem weitermachen können
    // (TSE-Lager-Bewegung ohne Installation ist erlaubt).
    const tsesWithoutTarget = selectedDevices.filter(d => isTse(d) && !tseTargets[d.id])
    if (tsesWithoutTarget.length > 0) {
      const ok = window.confirm(
        `${tsesWithoutTarget.length} TSE ohne Ziel-Kasse. Trotzdem weiter? Die TSE wird beim Kunden geführt, aber nicht in eine Kasse eingebaut.`,
      )
      if (!ok) return
    }
    setIsLoading(true)
    await onNext({
      deviceIds: selectedIds,
      deviceAssignments: assignments,
      tseInstallTargets: tseTargets,
    })
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
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const serials: string[] = Array.isArray(json.serials) ? json.serials : []
      if (serials.length === 0) {
        toast.error('Keine Seriennummer erkannt', {
          description: 'Versuche es mit einem schärferen Foto vom Typenschild.',
        })
        return
      }
      const normSerials = serials.map(normalizeSerial)
      const matches = stockDevices.filter(d => {
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
      setSelectedIds(prev => {
        const set = new Set(prev)
        for (const m of matches) set.add(m.id)
        return Array.from(set)
      })
      setAssignments(a => {
        const next = { ...a }
        for (const m of matches) {
          if (!next[m.id]) next[m.id] = { kind: 'leihe', swapInDeviceId: null }
        }
        return next
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
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Eingesetzte Geräte</h2>
        <p className="text-[12.5px] text-[var(--ink-3)] mt-1">
          Nur Geräte mit Status „Lager" sind wählbar. Kassen + Geräte: Leihe, Installiert oder Austausch. TSE-Module werden in eine Kasse beim Kunden installiert.
        </p>
      </div>

      {/* Auswahl mit Aktions-Picker */}
      {selectedDevices.length > 0 && (
        <div className="space-y-2">
          {selectedDevices.map(d => {
            const choice = assignments[d.id] ?? { kind: 'leihe' as const, swapInDeviceId: null }
            return (
              <div
                key={d.id}
                className="rounded-kb border border-[var(--rule)] bg-white p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[var(--ink)] truncate">
                      {deviceDisplayName(d.model)}
                    </div>
                    {d.serial_number && (
                      <div className="text-[11.5px] text-[var(--ink-4)] kb-mono">SN {d.serial_number}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDevice(d.id)}
                    className="rounded-full p-1 hover:bg-[var(--paper-2)] transition-colors"
                    aria-label="Entfernen"
                  >
                    <X className="h-3.5 w-3.5 text-[var(--ink-3)]" />
                  </button>
                </div>

                {/* TSE → Kasse-Picker, kein Lifecycle-Picker.
                     Andere Geräte → Leihe / Installiert / Austausch. */}
                {isTse(d) ? (
                  <div className="space-y-1.5">
                    <label className="text-[11.5px] font-medium text-[var(--ink-3)]">
                      In welche Kasse wird die TSE installiert?
                    </label>
                    {kassenForTseInstall.length === 0 ? (
                      <div className="text-[12px] text-[var(--amber)]">
                        Keine Kasse beim Kunden gefunden. TSE wird ohne Kopplung zugeordnet.
                      </div>
                    ) : (
                      <select
                        value={tseTargets[d.id] ?? ''}
                        onChange={e => setTseTarget(d.id, e.target.value || null)}
                        className="w-full rounded-md border border-[var(--rule)] bg-white px-2 py-1.5 text-[13px]"
                      >
                        <option value="">— Kasse wählen —</option>
                        {kassenForTseInstall.map(k => (
                          <option key={k.id} value={k.id}>
                            {deviceDisplayName(k.model)}
                            {k.serial_number ? ` · SN ${k.serial_number}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-1 rounded-md bg-[var(--paper-2)] p-0.5">
                    {(['leihe', 'verkauf', 'austausch'] as AssignmentKind[]).map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(d.id, k)}
                        className={cn(
                          'flex-1 rounded-[5px] px-2 py-1 text-[12px] font-medium transition-colors',
                          choice.kind === k
                            ? 'bg-white text-[var(--ink)] shadow-xs'
                            : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
                        )}
                      >
                        {KIND_LABELS[k]}
                      </button>
                    ))}
                  </div>
                )}

                {!isTse(d) && choice.kind === 'austausch' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11.5px] font-medium text-[var(--ink-3)]">
                      Welches Gerät kommt zurück (geht in Reparatur)?
                    </label>
                    {customerDevices.length === 0 ? (
                      <div className="text-[12px] text-[var(--amber)]">
                        Beim Kunden ist aktuell kein verliehenes Gerät registriert.
                      </div>
                    ) : (
                      <select
                        value={choice.swapInDeviceId ?? ''}
                        onChange={e => setSwapIn(d.id, e.target.value || null)}
                        className="w-full rounded-md border border-[var(--rule)] bg-white px-2 py-1.5 text-[13px]"
                      >
                        <option value="">— wählen —</option>
                        {customerDevices.map(cd => (
                          <option key={cd.id} value={cd.id}>
                            {deviceDisplayName(cd.model)}
                            {cd.serial_number ? ` · SN ${cd.serial_number}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Such-/Scan-Leiste */}
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
