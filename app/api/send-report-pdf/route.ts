import { createClient } from '@/lib/supabase/server'
import { getMailTransporter, MAIL_FROM } from '@/lib/mail'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { reportId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }
  const reportId = body.reportId
  if (!reportId) {
    return Response.json({ error: 'reportId fehlt' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { data: report, error: reportErr } = await supabase
    .from('work_reports')
    .select('id, report_number, pdf_path, customer:customers(name, email)')
    .eq('id', reportId)
    .single()

  if (reportErr || !report) {
    return Response.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }
  if (!report.pdf_path) {
    return Response.json({ error: 'Kein PDF zum Bericht hinterlegt' }, { status: 400 })
  }
  const customer = (report as any).customer
  if (!customer?.email) {
    return Response.json({ error: 'Kunde hat keine E-Mail-Adresse' }, { status: 400 })
  }

  const { data: pdfBlob, error: dlErr } = await supabase.storage
    .from('work-report-pdfs')
    .download(report.pdf_path)
  if (dlErr || !pdfBlob) {
    return Response.json({ error: 'PDF konnte nicht geladen werden' }, { status: 500 })
  }
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

  const subject = `Arbeitsbericht ${report.report_number ?? ''}`.trim()
  const greeting = `Sehr geehrte/r ${customer.name},`
  const text = `${greeting}

anbei der Arbeitsbericht zu den heute durchgeführten Arbeiten.

Bei Fragen können Sie uns jederzeit kontaktieren.

Mit freundlichen Grüßen
Kassen Buch`

  const html = `<!DOCTYPE html>
<html lang="de"><body style="font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.55; max-width: 560px;">
  <p>${greeting}</p>
  <p>anbei der Arbeitsbericht zu den heute durchgeführten Arbeiten.</p>
  <p>Bei Fragen können Sie uns jederzeit kontaktieren.</p>
  <p>Mit freundlichen Grüßen<br/>Kassen Buch</p>
</body></html>`

  try {
    const transporter = getMailTransporter()
    await transporter.sendMail({
      from: MAIL_FROM,
      to: customer.email,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `${report.report_number ?? report.id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ error: `SMTP-Versand fehlgeschlagen: ${msg}` }, { status: 502 })
  }

  await supabase
    .from('work_reports')
    .update({ pdf_emailed_at: new Date().toISOString() })
    .eq('id', reportId)

  return Response.json({ ok: true, sentTo: customer.email })
}
