import nodemailer from 'nodemailer'

// SMTP-Konfiguration kommt ueber Env-Vars von der VPS (.env.local).
// Niemals Default-Werte hier hinterlegen — fail loud, wenn was fehlt.
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`SMTP-Konfig fehlt: ${key} ist nicht gesetzt`)
  }
  return value
}

let cachedTransporter: nodemailer.Transporter | null = null

export function getMailTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter

  const host = requireEnv('SMTP_HOST')
  const port = parseInt(requireEnv('SMTP_PORT'), 10)
  const user = requireEnv('SMTP_USER')
  const pass = requireEnv('SMTP_PASS')

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return cachedTransporter
}

export const MAIL_FROM = process.env.MAIL_FROM ?? 'Kassen Buch <info@kassen-buch.com>'
