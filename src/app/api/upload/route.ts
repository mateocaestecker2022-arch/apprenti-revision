import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

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

  if (ext === 'txt') {
    text = buffer.toString('utf-8')
  } else if (ext === 'docx' || ext === 'odt') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
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

  if (!text || text.trim().length < 10) {
    return NextResponse.json({ error: 'Impossible de lire le fichier' }, { status: 400 })
  }

  return NextResponse.json({ text: text.trim() })
}
