# DOCUMENT SKILL

Last updated: 2026-06-26
Version: 1
Scope: Design Agent, Content Writer, All Agents

## PURPOSE

Production system for creating professional documents:
PDFs, Word docs (.docx), presentations, and print-ready files.
From content to exported files, ready to share or print.

## DOCUMENT TYPES

### PDF Documents

Use cases:
  - Reports and proposals
  - Invoices and receipts
  - Ebooks and guides
  - Whitepapers
  - Print-ready materials

Tools:
  - Playwright (HTML → PDF) — preferred for styled documents
  - Puppeteer (HTML → PDF) — alternative
  - Pandoc (Markdown → PDF) — for simple documents

### Word Documents (.docx)

Use cases:
  - Editable templates
  - Client deliverables
  - Contracts and agreements
  - Reports that need editing
  - Collaborative documents

Tools:
  - docx npm package — programmatic creation
  - Pandoc (Markdown → DOCX) — for simple conversion

### Presentations

Use cases:
  - Slide decks
  - Pitch decks
  - Training materials

Tools:
  - Reveal.js (HTML → PDF/PPTX)
  - Marp (Markdown → PPTX/PDF)
  - LibreOffice Impress (if installed)

## BRAND SPECS (for all documents)

Colors:
  Background: #0A0A0A (dark mode PDFs)
  Background: #FFFFFF (print PDFs)
  Card: #141414 (containers)
  Text primary: #000000 (print) / #FFFFFF (dark)
  Text secondary: #666666 (print) / #A0A0A0 (dark)
  Accent: #FF6500 (headers, key points)

Typography:
  Headings: Montserrat Bold
  Body: Montserrat Regular or Inter
  Code: Fira Code or JetBrains Mono
  Serif (print): Playfair Display

Layout:
  margins: 1 inch (72pt) standard, 0.5 inch compact
  line_height: 1.5 for body text
  paragraph_spacing: 12pt after each paragraph
  page_size: A4 (210×297mm) or US Letter (8.5×11in)

## PRODUCTION FLOW

### PDF from HTML (styled documents)

1. Write HTML with inline CSS
2. Use Playwright to render and export PDF
3. Set page size, margins, headers/footers
4. Export with proper pagination

Script:
```javascript
const { chromium } = require('playwright');

async function htmlToPdf(html, outputPath, options = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle' });
  
  await page.pdf({
    path: outputPath,
    format: options.format || 'A4',
    margin: options.margin || { top: '1in', bottom: '1in', left: '1in', right: '1in' },
    printBackground: true,
    displayHeaderFooter: options.headerFooter || false,
    headerTemplate: options.header || '<div></div>',
    footerTemplate: options.footer || '<div></div>'
  });
  
  await browser.close();
}
```

### Word Doc (.docx)

1. Define document structure (sections, headings, paragraphs)
2. Use docx package to build document
3. Add styling (fonts, colors, spacing)
4. Export to .docx

Script:
```javascript
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

async function createDocx(content, outputPath) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: content.map(item => {
        if (item.type === 'heading') {
          return new Paragraph({
            text: item.text,
            heading: HeadingLevel[item.level] || HeadingLevel.HEADING_1
          });
        }
        return new Paragraph({
          children: [new TextRun({ text: item.text, bold: item.bold })]
        });
      })
    }]
  });
  
  const buffer = await Packer.toBuffer(doc);
  require('fs').writeFileSync(outputPath, buffer);
}
```

### Markdown → Any Format (via Pandoc)

```bash
# PDF
pandoc input.md -o output.pdf --pdf-engine=xelatex -V geometry:margin=1in

# Word
pandoc input.md -o output.docx

# HTML
pandoc input.md -o output.html --standalone

# PowerPoint
pandoc input.md -o output.pptx
```

## LAYOUT TEMPLATES

### Report / Proposal

Structure:
  - Cover page (title, date, author)
  - Table of contents
  - Executive summary
  - Main content (numbered sections)
  - Conclusion
  - Appendices

Style:
  - Professional, clean layout
  - Montserrat for headings
  - Inter or regular for body
  - Accent color for headers only

### Invoice

Structure:
  - Company logo/header
  - Invoice number and date
  - Client details
  - Line items table
  - Subtotal, tax, total
  - Payment terms

Style:
  - Clean, minimal
  - Table with alternating row colors
  - Accent for totals

### Ebook / Guide

Structure:
  - Cover page
  - Table of contents
  - Chapter headings
  - Content with callouts
  - About the author
  - CTA / next steps

Style:
  - Readable typography (12pt+ body)
  - Pull quotes with accent color
  - Code blocks with card background
  - Page breaks between chapters

## COMMON MISTAKES TO AVOID

- No page breaks between sections
- Inconsistent heading styles
- Too small font for print (min 10pt body)
- No margins or too tight margins
- Missing page numbers
- Inconsistent spacing
- Low contrast text on colored backgrounds
- Not embedding fonts (use system fonts or embed)
