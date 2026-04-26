import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { DOMParser } from '@xmldom/xmldom'
import JSZip from 'jszip'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  let text = ''

  try {
    if (ext === 'txt') {
      text = buffer.toString('utf-8')
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (ext === 'odt') {
      // Extraire le texte d'un fichier ODT (format ZIP avec content.xml)
      const zip = await JSZip.loadAsync(buffer)
      const contentXml = await zip.file('content.xml')?.async('string')
      if (!contentXml) throw new Error('Fichier ODT invalide')
      // Supprimer les balises XML pour récupérer le texte brut
      text = contentXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    } else if (ext === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      text = data.text
    } else {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez .docx, .odt, .pdf ou .txt' },
        { status: 400 }
      )
    }
  } catch (err) {
    console.error('Erreur lecture fichier:', err)
    return NextResponse.json({ error: 'Impossible de lire le fichier. Vérifiez qu\'il n\'est pas corrompu.' }, { status: 400 })
  }

  if (!text || text.trim().length < 10) {
    return NextResponse.json({ error: 'Le fichier semble vide ou illisible' }, { status: 400 })
  }

  return NextResponse.json({ text: text.trim() })
}
