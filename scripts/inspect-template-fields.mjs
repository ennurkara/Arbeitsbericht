// One-shot: list every AcroForm field in arbeitsbericht-vorlage.pdf with its
// type and rectangle, so we can map ZE / price / total to the right widgets.
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'

const bytes = readFileSync(new URL('../public/templates/arbeitsbericht-vorlage.pdf', import.meta.url))
const doc = await PDFDocument.load(bytes)
const form = doc.getForm()
const fields = form.getFields()
console.log(`Total fields: ${fields.length}`)
for (const f of fields) {
  const name = f.getName()
  const ctor = f.constructor.name
  let rect = ''
  try {
    const widgets = f.acroField.getWidgets()
    if (widgets[0]) {
      const r = widgets[0].getRectangle()
      rect = ` rect=(${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.width.toFixed(0)}×${r.height.toFixed(0)})`
    }
  } catch {}
  console.log(`${ctor.padEnd(15)} ${name}${rect}`)
}
