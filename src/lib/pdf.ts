import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Generates a PDF for a SRS Deck (Flashcards)
 */
export async function generateSRSPDF(deck: any) {
  const doc = new jsPDF()
  const primaryColor = [201, 168, 76] // #c9a84c

  // Header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 210, 40, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('LexJuridica', 20, 20)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('Vos Flashcards de Révision', 20, 30)

  // Title
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(deck.title, 20, 55)

  const cards = deck.cards_raw || []
  
  // Table for cards
  const tableData = cards.map((c: any, index: number) => [
    index + 1,
    c.front,
    c.back
  ])

  autoTable(doc, {
    startY: 65,
    head: [['#', 'Question', 'Réponse']],
    body: tableData,
    headStyles: {
      fillColor: primaryColor as [number, number, number],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [250, 248, 240]
    },
    margin: { top: 60 },
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 80 },
      2: { cellWidth: 90 }
    }
  })

  doc.save(`flashcards-${deck.title.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

/**
 * Generates a PDF for a Revision Fiche (Document Summary)
 */
export async function generateFichePDF(document: any) {
  const doc = new jsPDF()
  const primaryColor = [201, 168, 76] // #c9a84c

  // Header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 210, 30, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('LexJuridica', 20, 15)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Fiche de Révision - Votre Tuteur Juridique IA', 20, 22)

  // Title
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(document.title, 20, 50)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text(`Générée le ${new Date(document.created_at).toLocaleDateString()}`, 20, 58)

  // Content
  const cleanContent = document.summary_html
    .replace(/<h[1-6][^>]*>/gi, '\n\n') // Headers to newlines
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ') // List items
    .replace(/<\/li>/gi, '')
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<strong[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '') // Remove any remaining tags
    .replace(/\n\s*\n/g, '\n\n') // Remove extra whitespace
    .trim()

  autoTable(doc, {
    startY: 70,
    body: [[cleanContent]],
    styles: {
      font: 'helvetica',
      fontSize: 11,
      cellPadding: 5,
      overflow: 'linebreak'
    },
    theme: 'plain',
    margin: { left: 20, right: 20 }
  })

  doc.save(`fiche-${document.title.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
