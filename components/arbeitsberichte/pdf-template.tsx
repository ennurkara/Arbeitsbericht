interface PdfTemplateProps {
  reportNumber: string | null
  customer: { name: string; address: string | null; postal_code: string | null; city: string | null; phone: string | null; email: string | null }
  technician: { full_name: string }
  report: {
    description: string | null
    work_hours: number | null
    travel_from: string | null
    travel_to: string | null
    travel_distance_km: number | null
    start_time: string
    end_time: string | null
  }
  devices: Array<{ id: string; name: string; serial_number: string | null }>
  technicianSignature: string
  customerSignature: string
}

export function PdfTemplate({
  reportNumber, customer, technician, report, devices,
  technicianSignature, customerSignature,
}: PdfTemplateProps) {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('de-DE', opts).format(new Date(iso))

  const dateStr = fmt(report.start_time, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const startStr = fmt(report.start_time, { hour: '2-digit', minute: '2-digit' })
  const endStr = report.end_time
    ? fmt(report.end_time, { hour: '2-digit', minute: '2-digit' })
    : '—'

  const distanceStr = report.travel_distance_km != null
    ? `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(report.travel_distance_km)} km`
    : null

  return (
    <div
      id="pdf-template"
      style={{
        position: 'fixed', left: '-9999px', top: 0,
        width: '794px', backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif', fontSize: '12px',
        color: '#1e293b', padding: '0', boxSizing: 'border-box',
      }}
    >
      {/* Blue header */}
      <div style={{
        backgroundColor: '#1e40af', padding: '20px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          ARBEITSBERICHT
        </div>
        <div style={{ textAlign: 'right', color: '#93c5fd', fontSize: '11px', lineHeight: '1.6' }}>
          <div style={{ fontWeight: '600' }}>{reportNumber ?? '—'}</div>
          <div>{dateStr}</div>
        </div>
      </div>

      <div style={{ padding: '24px 40px 40px' }}>
        {/* Kunde + Techniker */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Kunde
            </div>
            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{customer.name}</div>
            {customer.address && <div style={{ color: '#475569', fontSize: '11px' }}>{customer.address}</div>}
            {(customer.postal_code || customer.city) && (
              <div style={{ color: '#475569', fontSize: '11px' }}>
                {[customer.postal_code, customer.city].filter(Boolean).join(' ')}
              </div>
            )}
            {customer.phone && <div style={{ color: '#475569', fontSize: '11px' }}>{customer.phone}</div>}
            {customer.email && <div style={{ color: '#475569', fontSize: '11px' }}>{customer.email}</div>}
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Techniker
            </div>
            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{technician.full_name}</div>
            <div style={{ color: '#475569', fontSize: '11px' }}>
              {report.work_hours}h
              {report.travel_from && report.travel_to && ` | ${report.travel_from} → ${report.travel_to}`}
            </div>
            {distanceStr && (
              <div style={{ color: '#475569', fontSize: '11px' }}>Distanz: {distanceStr}</div>
            )}
            <div style={{ color: '#475569', fontSize: '11px' }}>{startStr} – {endStr} Uhr</div>
          </div>
        </div>

        {/* Tätigkeit */}
        <div style={{ backgroundColor: '#f1f5f9', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: '#475569', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
            Ausgeführte Tätigkeit
          </div>
          <div style={{ color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {report.description ?? '—'}
          </div>
        </div>

        {/* Geräte table */}
        {devices.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ color: '#475569', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
              Installierte Geräte
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#e2e8f0' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', color: '#475569', fontWeight: '600' }}>Gerät</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', color: '#475569', fontWeight: '600' }}>Seriennummer</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d, i) => (
                  <tr key={d.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '6px 10px', fontSize: '11px', color: '#334155' }}>{d.name}</td>
                    <td style={{ padding: '6px 10px', fontSize: '11px', color: '#64748b' }}>{d.serial_number ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unterschriften */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <img src={technicianSignature} alt="Unterschrift Techniker"
              style={{ width: '100%', height: '90px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: 'white' }} />
            <div style={{ borderTop: '1px solid #334155', paddingTop: '6px', marginTop: '6px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
              {technician.full_name} (Techniker)
            </div>
          </div>
          <div>
            <img src={customerSignature} alt="Unterschrift Kunde"
              style={{ width: '100%', height: '90px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: 'white' }} />
            <div style={{ borderTop: '1px solid #334155', paddingTop: '6px', marginTop: '6px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
              {customer.name} (Kunde)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}