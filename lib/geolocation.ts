// Client-side helper: aktueller Geräte-Standort → formatierte Adresse via
// OpenStreetMap Nominatim. Nominatim-Fair-Use: max 1 Request/s; ein manueller
// Button-Klick liegt weit unter dieser Grenze.
//
// Routing-Distanz via OSRM public endpoint (router.project-osrm.org).
// Auch Fair-Use, kein API-Key. Für Prod ggf. eigenes OSRM hosten.

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

export interface RouteDistance {
  /** Straßen-Routen-Distanz in Kilometern (z.B. 24.3) */
  distanceKm: number
  /** Geschätzte Fahrzeit in Minuten */
  durationMin: number
}

/**
 * Berechnet Straßen-Distanz zwischen zwei Adressen via Nominatim (Geocoding) +
 * OSRM (Routing). Beide Adressen werden parallel geocodiert.
 */
export async function calculateRouteDistance(from: string, to: string): Promise<RouteDistance> {
  const [fromCoords, toCoords] = await Promise.all([
    geocodeAddress(from),
    geocodeAddress(to),
  ])

  const url =
    'https://router.project-osrm.org/route/v1/driving/' +
    `${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}` +
    '?overview=false'

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Routenberechnung fehlgeschlagen')
  const json = (await res.json()) as {
    routes?: Array<{ distance: number; duration: number }>
  }
  const route = json.routes?.[0]
  if (!route) throw new Error('Keine Route gefunden')

  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  }
}

async function geocodeAddress(query: string): Promise<{ lat: number; lon: number }> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('accept-language', 'de')

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Geocoding fehlgeschlagen')
  const json = (await res.json()) as Array<{ lat: string; lon: string }>
  const hit = json[0]
  if (!hit) throw new Error(`Adresse nicht gefunden: ${query}`)

  return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) }
}
