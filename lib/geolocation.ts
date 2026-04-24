// Client-side helper: aktueller Geräte-Standort → Stadtname via OpenStreetMap
// Nominatim. Nominatim-Fair-Use: max 1 Request/s, kein Bulk-Reverse. Ein
// manueller Button-Klick liegt weit unter dieser Grenze.

export async function detectCurrentCity(): Promise<string> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('Geolocation wird vom Browser nicht unterstützt')
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 60_000,
    })
  })

  const { latitude, longitude } = position.coords
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'json')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('zoom', '10') // City-Level
  url.searchParams.set('accept-language', 'de')

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Adress-Lookup fehlgeschlagen')

  const json = (await res.json()) as {
    address?: {
      city?: string
      town?: string
      village?: string
      municipality?: string
      county?: string
    }
  }
  const addr = json.address ?? {}
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county
  if (!city) throw new Error('Stadt nicht gefunden')
  return city
}
