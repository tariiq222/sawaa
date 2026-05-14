/**
 * Deqah Booking Widget — Embed Script
 *
 * Usage (auto locale detection):
 *   <script src="/widget/embed.js" data-auto-open></script>
 *
 * Override locale manually:
 *   <script src="/widget/embed.js" data-locale="en" data-auto-open></script>
 *
 * Programmatically:
 *   DeqahWidget.open()
 *   DeqahWidget.open({ locale: 'en' })
 *
 * Events:
 *   DeqahWidget.on('deqah:booking:complete', fn)
 *   DeqahWidget.on('deqah:widget:close', fn)
 */

;(function () {
  var WIDGET_BASE = (function () {
    var scripts = document.getElementsByTagName('script')
    var src = scripts[scripts.length - 1].src
    return src.replace('/widget/embed.js', '')
  })()

  var currentFrame = null
  var currentOrigin = window.location.origin

  /**
   * Detect the host page locale.
   * Priority:
   *   1. data-locale on the script tag  (explicit override)
   *   2. <html lang="...">              (standard HTML attribute)
   *   3. navigator.language             (browser preference)
   *   4. 'ar'                           (fallback)
   *
   * Only 'ar' and 'en' are supported — anything else falls back to 'ar'.
   */
  function detectLocale(scriptEl) {
    var explicit = scriptEl && scriptEl.getAttribute('data-locale')
    if (explicit === 'ar' || explicit === 'en') return explicit

    var htmlLang = (document.documentElement.lang || '').toLowerCase()
    if (htmlLang.startsWith('en')) return 'en'
    if (htmlLang.startsWith('ar')) return 'ar'

    var navLang = (navigator.language || '').toLowerCase()
    if (navLang.startsWith('en')) return 'en'

    return 'ar'
  }

  function buildUrl(opts) {
    var params = new URLSearchParams()
    if (opts.locale) params.set('locale', opts.locale)
    if (opts.flow)   params.set('flow', opts.flow)
    params.set('origin', currentOrigin)
    return WIDGET_BASE + '/booking?' + params.toString()
  }

  function createFrame(opts) {
    var overlay = document.createElement('div')
    overlay.id = 'deqah-widget-overlay'
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.4)', 'backdrop-filter:blur(4px)',
    ].join(';')

    var frame = document.createElement('iframe')
    frame.src = buildUrl(opts)
    frame.style.cssText = [
      'width:440px', 'max-width:calc(100vw - 32px)',
      'height:680px', 'max-height:calc(100vh - 32px)',
      'border:none', 'border-radius:16px',
      'box-shadow:0 24px 80px rgba(0,0,0,0.3)',
      'background:#fff',
    ].join(';')
    frame.setAttribute('allow', 'payment')
    frame.setAttribute('title', 'Booking Widget')

    overlay.onclick = function (e) {
      if (e.target === overlay) DeqahWidget.close()
    }

    overlay.appendChild(frame)
    document.body.appendChild(overlay)
    currentFrame = frame
    return frame
  }

  function handleMessage(event) {
    if (event.origin !== WIDGET_BASE && WIDGET_BASE !== '') return

    var data = event.data
    if (!data || typeof data.type !== 'string') return
    if (!data.type.startsWith('deqah:')) return

    if (data.type === 'deqah:widget:close') {
      DeqahWidget.close()
    }

    if (data.type === 'deqah:widget:resize' && currentFrame && data.height) {
      var maxH = window.innerHeight - 32
      currentFrame.style.height = Math.min(data.height, maxH) + 'px'
    }

    if (listeners[data.type]) {
      listeners[data.type].forEach(function (fn) { fn(data) })
    }
  }

  window.addEventListener('message', handleMessage)

  var listeners = {}

  window.DeqahWidget = {
    open: function (opts) {
      opts = opts || {}
      var s = document.currentScript || document.querySelector('script[src*="embed.js"]')

      // Auto-detect locale unless caller passed it explicitly
      if (!opts.locale) {
        opts.locale = detectLocale(s)
      }

      if (s && !opts.flow) {
        opts.flow = s.getAttribute('data-flow') || undefined
      }

      if (document.getElementById('deqah-widget-overlay')) return
      createFrame(opts)
    },

    close: function () {
      var overlay = document.getElementById('deqah-widget-overlay')
      if (overlay) overlay.remove()
      currentFrame = null
    },

    on: function (eventType, callback) {
      if (!listeners[eventType]) listeners[eventType] = []
      listeners[eventType].push(callback)
    },

    off: function (eventType, callback) {
      if (!listeners[eventType]) return
      listeners[eventType] = listeners[eventType].filter(function (fn) { return fn !== callback })
    },
  }

  /* Auto-open if data-auto-open attribute is set */
  document.addEventListener('DOMContentLoaded', function () {
    var s = document.querySelector('script[src*="embed.js"][data-auto-open]')
    if (s) DeqahWidget.open()
  })
})()
