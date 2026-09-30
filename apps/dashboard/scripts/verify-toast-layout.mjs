// Isolated real-Chromium component check; no API requests or notification sends.
import path from 'node:path'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const root = path.resolve(__dirname, '..')
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {toast} from 'sonner';
        import {AppToaster} from './components/app-toaster';
        import {LocaleProvider,useLocale} from './components/locale-provider';
        function Demo(){const {toggleLocale}=useLocale();return <><button onClick={toggleLocale}>Toggle</button><AppToaster/></>}
        createRoot(document.getElementById('root')).render(<LocaleProvider><Demo/></LocaleProvider>);
        window.notify=(type)=>toast[type]('تم تحديث بيانات الموعد بنجاح — ABC-123', {duration:Infinity,
          description:'رسالة عربية طويلة للتحقق من التفاف النص وعدم تداخله مع الأزرار. '.repeat(4)+'https://example.test/'+ 'a'.repeat(100),
          action:{label:'عرض تفاصيل الموعد',onClick:()=>{window.actionClicked=true}},cancel:{label:'إغلاق التنبيه',onClick:()=>{} }});
        window.clearNotifications=()=>toast.dismiss();`,
      resolveDir: root, loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    tsconfig: path.join(root, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const css = await fs.readFile(path.join(root, 'app/toast.css'), 'utf8')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.route('http://toast.test/**', route => route.fulfill({ contentType:'text/html', body:'<!doctype html><html lang="ar" dir="rtl"><head></head><body><div id="root"></div></body></html>' }))
    await page.goto('http://toast.test')
    await page.addStyleTag({ content: ':root{--foreground:#212121;--surface-solid:#fff;--border-strong:#ccc;--muted:#555;--primary:#245b50;--primary-foreground:#fff;--radius-lg:12px;--radius-md:8px;--success:green;--error:#a00;--warning:#960;--info:#059}*{box-sizing:border-box}' + css })
    await page.addScriptTag({ content: result.outputFiles[0].text })
    await page.getByRole('button', { name:'Toggle' }).waitFor()
    let cases = 0
    for (const dir of ['rtl', 'ltr']) {
      if(dir === 'ltr') await page.getByRole('button', { name:'Toggle' }).click()
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const type of ['success','error','warning','info','loading']) {
          await page.evaluate(type => window.notify(type), type)
          const toast = page.locator('[data-sonner-toast][data-removed="false"]').last()
          await toast.waitFor({state:'visible'})
          await page.waitForFunction(() => [...document.querySelectorAll('[data-sonner-toast]')].some(e => e.dataset.mounted === 'true'))
          const metrics = await toast.evaluate(el => {
            const box=el.getBoundingClientRect();
            return {left:box.left,right:box.right,width:box.width,scroll:el.scrollWidth,client:el.clientWidth,
              dir:el.parentElement.dir,children:[...el.querySelectorAll('[data-content],[data-button]')].map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:c.scrollWidth,client:c.clientWidth}})}
          })
          assert.equal(metrics.dir, dir)
          assert.ok(metrics.left >= 0 && metrics.right <= width, JSON.stringify({width,type,metrics}))
          assert.ok(metrics.scroll <= metrics.client + 1, JSON.stringify({width,type,metrics}))
          for(const child of metrics.children) {
            assert.ok(child.scroll <= child.client + 1, JSON.stringify({width,type,child}))
            assert.ok(child.left >= metrics.left - 1 && child.right <= metrics.right + 1, JSON.stringify({width,type,child}))
          }
          for(let i=0;i<metrics.children.length;i++) for(let j=i+1;j<metrics.children.length;j++) {
            const a=metrics.children[i], b=metrics.children[j]
            const overlapX=Math.min(a.right,b.right)-Math.max(a.left,b.left)
            const overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)
            assert.ok(overlapX <= 1 || overlapY <= 1, 'Toast content and actions overlap')
          }
          if(type === 'success') {
            await toast.getByRole('button',{name:'عرض تفاصيل الموعد'}).click()
            assert.equal(await page.evaluate(()=>window.actionClicked),true)
          }
          await page.evaluate(()=>window.clearNotifications())
          await page.locator('[data-sonner-toast]').waitFor({state:'detached'})
          cases++
        }
      }
    }
    console.log(`PASS: ${cases} real Chromium toast cases, AR/EN, 320/375/768/1440px, all five variants, long mixed text and action buttons`)
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode=1 })
