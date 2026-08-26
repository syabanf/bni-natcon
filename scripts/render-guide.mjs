// Render the guide with its running footer. Used by scripts/build-guide.sh;
// needs puppeteer-core (npm i puppeteer-core) and a local Chrome.
import puppeteer from 'puppeteer-core'
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [,, src, out] = process.argv
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.goto(`file://${src}`, { waitUntil: 'networkidle0', timeout: 120000 })
await page.pdf({
  path: out, format: 'A4', printBackground: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: `
    <div style="width:100%; font-size:7.5px; font-family:Arial,Helvetica,sans-serif; color:#8b919b;
                padding:0 13mm; display:flex; justify-content:space-between;">
      <span>BNI Natcon 2026 · Panduan Aplikasi</span>
      <span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '13mm', right: '13mm', bottom: '16mm', left: '13mm' },
})
console.log('✓', out)
await browser.close()
