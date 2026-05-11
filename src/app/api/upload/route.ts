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

  // [FIX #3] Limite de taille — évite DoS par chargement en RAM
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 413 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  // Validation magic bytes — évite les fichiers malveillants renommés
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04
  if (ext === 'pdf' && !isPdf) return NextResponse.json({ error: 'Fichier PDF invalide' }, { status: 400 })
  if ((ext === 'docx' || ext === 'odt') && !isZip) return NextResponse.json({ error: `Fichier ${ext.toUpperCase()} invalide` }, { status: 400 })

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
