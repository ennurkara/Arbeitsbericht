// Client-side helper: aktueller Geräte-Standort → formatierte Adresse via
// OpenStreetMap Nominatim. Nominatim-Fair-Use: max 1 Request/s; ein manueller
// Button-Klick liegt weit unter dieser Grenze.

export interface DetectedAddress {
  /** Menschenlesbar zusammengesetzt, z.B. "Hauptstraße 12, 82239 Alling". Für direkt in Textfelder. */
  formatted: string
  /** Straße + Nr. */
  street: string | null
  /** PLZ */
  postalCode: string | null
  /** Ort (city/town/village/municipality Fallback). */
  city: string | null
}

export async function detectCurrentAddress(): Promise<DetectedAddress> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('Geolocation wird vom Browser nicht unterstützt')
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 60_000,
    })
  })

  const { latitude, longitude } = position.coords
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'json')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('zoom', '18') // Haus-Level
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'de')

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Adress-Lookup fehlgeschlagen')

  const json = (await res.json()) as {
    address?: {
      road?: string
      pedestrian?: string
      house_number?: string
      postcode?: string
      city?: string
      town?: string
      village?: string
      municipality?: string
      county?: string
    }
  }
  const a = json.address ?? {}
  const road = a.road ?? a.pedestrian ?? null
  const street = road ? (a.house_number ? `${road} ${a.house_number}` : road) : null
  const postalCode = a.postcode ?? null
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null

  if (!street && !city) throw new Error('Adresse nicht gefunden')

  const formatted = [
    street,
    [postalCode, city].filter(Boolean).join(' ').trim() || null,
  ].filter(Boolean).join(', ')

  return { formatted, street, postalCode, city }
}
