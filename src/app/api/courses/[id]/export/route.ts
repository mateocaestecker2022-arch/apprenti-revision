import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import JSZip from 'jszip'

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface Notion { term: string; definition: string }
interface Section { title: string; notions?: Notion[]; points?: string[]; retenir?: string }
interface StructuredContent { title: string; plan?: string[]; sections?: Section[]; summary?: string }

function buildDocxXml(s: StructuredContent | null, raw: string): string {
  const h1 = (t: string) => `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${esc(t)}</w:t></w:r></w:p>`
  const h2 = (t: string) => `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${esc(t)}</w:t></w:r></w:p>`
  const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`
  const bp = (b: string, rest: string) => `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(b)}</w:t></w:r><w:r><w:t xml:space="preserve">${esc(rest)}</w:t></w:r></w:p>`
  const br = () => `<w:p/>`

  const parts: string[] = []

  if (s?.title) parts.push(h1(s.title))
  if (s?.summary) { parts.push(p('Résumé')); parts.push(p(s.summary)); parts.push(br()) }

  if (s?.sections?.length) {
    for (const sec of s.sections) {
      parts.push(h2(sec.title))
      if (sec.notions?.length) {
        parts.push(p('Notions clés'))
        for (const n of sec.notions) parts.push(bp(`${n.term} : `, n.definition))
      }
      if (sec.points?.length) {
        parts.push(p('Points essentiels'))
        for (const pt of sec.points) parts.push(p(`• ${pt}`))
      }
      if (sec.retenir) parts.push(bp('A retenir : ', sec.retenir))
      parts.push(br())
    }
  } else {
    for (const line of raw.split('\n').slice(0, 300)) parts.push(p(line || ' '))
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${parts.join('\n    ')}
    <w:sectPr/>
  </w:body>
</w:document>`
}

function buildOdtContentXml(s: StructuredContent | null, raw: string): string {
  const h1 = (t: string) => `<text:h text:style-name="Heading_20_1" text:outline-level="1">${esc(t)}</text:h>`
  const h2 = (t: string) => `<text:h text:style-name="Heading_20_2" text:outline-level="2">${esc(t)}</text:h>`
  const p = (t: string) => `<text:p text:style-name="Text_20_Body">${esc(t)}</text:p>`
  const bp = (b: string, rest: string) => `<text:p text:style-name="Text_20_Body"><text:span text:style-name="Bold">${esc(b)}</text:span>${esc(rest)}</text:p>`

  const parts: string[] = []

  if (s?.title) parts.push(h1(s.title))
  if (s?.summary) { parts.push(p('Résumé')); parts.push(p(s.summary)) }

  if (s?.sections?.length) {
    for (const sec of s.sections) {
      parts.push(h2(sec.title))
      if (sec.notions?.length) {
        parts.push(p('Notions clés'))
        for (const n of sec.notions) parts.push(bp(`${n.term} : `, n.definition))
      }
      if (sec.points?.length) {
        parts.push(p('Points essentiels'))
        for (const pt of sec.points) parts.push(p(`• ${pt}`))
      }
      if (sec.retenir) parts.push(bp('A retenir : ', sec.retenir))
    }
  } else {
    for (const line of raw.split('\n').slice(0, 300)) parts.push(p(line || ' '))
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="Bold" style:family="text">
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${parts.join('\n      ')}
    </office:text>
  </office:body>
</office:document-content>`
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const format = req.nextUrl.searchParams.get('format') || 'docx'

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const s = course.structuredContent as StructuredContent | null
  const filename = (course.title || 'cours').replace(/[^a-z0-9]/gi, '_')

  if (format === 'docx') {
    const zip = new JSZip()

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`)

    zip.file('word/document.xml', buildDocxXml(s, course.rawContent))

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    })
  }

  if (format === 'odt') {
    const zip = new JSZip()

    zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' })

    zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`)

    zip.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">
  <office:styles>
    <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph">
      <style:text-properties fo:font-size="18pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph">
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Text_20_Body" style:display-name="Text Body" style:family="paragraph">
      <style:text-properties fo:font-size="11pt"/>
    </style:style>
  </office:styles>
</office:document-styles>`)

    zip.file('content.xml', buildOdtContentXml(s, course.rawContent))

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.oasis.opendocument.text',
        'Content-Disposition': `attachment; filename="${filename}.odt"`,
      },
    })
  }

  return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
}
