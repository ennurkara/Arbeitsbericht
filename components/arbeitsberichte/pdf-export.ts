export async function exportReportToPdf(
  reportNumber: string | null,
): Promise<Blob> {
  const element = document.getElementById('pdf-template')
  if (!element) throw new Error('PDF template element not found')

  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

  pdf.save(`${reportNumber ?? 'arbeitsbericht'}.pdf`)
  return pdf.output('blob')
}
