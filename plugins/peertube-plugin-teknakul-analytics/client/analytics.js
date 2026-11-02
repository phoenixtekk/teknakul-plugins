// Cross-platform analytics dashboard. Registers a /p/analytics route and a left-menu
// link. Reads GET /analytics from the restream API (Cloudflare route -> linuxg1:3082),
// which aggregates the creator's Teknakul (PeerTube) + Twitch + YouTube numbers.
// Read-only: it never changes anything on any platform. Twitch/YouTube figures appear
// once those accounts are linked in Unified Chat (/p/chat), which owns the OAuth connect.
async function register ({ registerHook, registerClientRoute, peertubeHelpers }) {
  const SKY = '#3ebdf8'
  const API = (window.TEKNAKUL_RESTREAM_API || 'https://restream.teknakul.com').replace(/\/$/, '')

  function authHeaders () {
    const h = (peertubeHelpers.getAuthHeader && peertubeHelpers.getAuthHeader()) || {}
    return Object.assign({ 'Content-Type': 'application/json' }, h)
  }
  async function api (path, opts) {
    const res = await fetch(API + path, Object.assign({ headers: authHeaders() }, opts || {}))
    let data = {}
    try { data = await res.json() } catch (e) {}
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status))
    return data
  }

  registerHook({
    target: 'filter:left-menu.links.create.result',
    handler: (result) => {
      try {
        const links = [{ label: 'Analytics', shortLabel: 'Analytics', path: '/p/analytics', icon: 'stats' }]
        return result.concat([{ key: 'teknakul-analytics', title: 'Teknakul', links }])
      } catch (e) { return result }
    }
  })

  registerClientRoute({
    route: 'analytics',
    onMount: ({ rootEl }) => { renderPage(rootEl) }
  })

  function el (tag, style, text) {
    const e = document.createElement(tag)
    if (style) Object.assign(e.style, style)
    if (text != null) e.textContent = text
    return e
  }
  function fmt (n) {
    n = Number(n || 0)
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K'
    return String(n)
  }

  async function renderPage (root) {
    root.innerHTML = ''
    Object.assign(root.style, { maxWidth: '880px', margin: '0 auto', padding: '24px 18px', color: 'var(--fg,#e6edf5)' })

    root.appendChild(el('h1', { fontSize: '26px', fontWeight: '800', margin: '0 0 4px' }, '📊 Analytics'))
    root.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '20px', fontSize: '15px' },
      'Your whole audience in one place — Teknakul, Twitch and YouTube.'))

    const loading = el('div', { color: 'var(--fg-350,#94a3b8)' }, 'Loading your numbers…')
    root.appendChild(loading)

    let d
    try { d = await api('/analytics') } catch (e) {
      loading.remove()
      root.appendChild(el('div', { color: '#f88' }, 'Could not load analytics (' + e.message + ').'))
      return
    }
    loading.remove()

    // ---- headline totals -----------------------------------------------------
    const t = d.totals || {}
    const totalsRow = el('div', { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px', marginBottom: '22px' })
    totalsRow.appendChild(statCard(t.anyLive ? '🔴 ' + fmt(t.liveViewers) : fmt(t.liveViewers), 'Watching live now', t.anyLive))
    totalsRow.appendChild(statCard(fmt(t.lifetimeViews), 'Lifetime views', false))
    totalsRow.appendChild(statCard(fmt(t.audience), 'Followers + subscribers', false))
    root.appendChild(totalsRow)

    // ---- per-platform --------------------------------------------------------
    const grid = el('div', { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '14px' })
    grid.appendChild(platformCard('Teknakul', '🟦', d.teknakul, [
      ['Live viewers', (d.teknakul.live || {}).viewers, (d.teknakul.live || {}).active],
      ['Lifetime views', d.teknakul.totalViews],
      ['Followers', d.teknakul.followers],
      ['Videos', d.teknakul.videos]
    ], null))
    grid.appendChild(platformCard('Twitch', '🟪', d.twitch, [
      ['Live viewers', (d.twitch.live || {}).viewers, (d.twitch.live || {}).active],
      ['Recent VOD views', d.twitch.vodViews]
    ], 'twitch'))
    grid.appendChild(platformCard('YouTube', '🟥', d.youtube, [
      ['Live viewers', (d.youtube.live || {}).viewers, (d.youtube.live || {}).active],
      ['Lifetime views', d.youtube.totalViews],
      ['Subscribers', d.youtube.subscribers],
      ['Videos', d.youtube.videos]
    ], 'youtube'))
    root.appendChild(grid)

    root.appendChild(el('div', { marginTop: '18px', fontSize: '12px', color: 'var(--fg-350,#94a3b8)' },
      'Live viewer counts are real-time; totals refresh when you open this page. Twitch and YouTube numbers appear once those accounts are linked in Unified Chat.'))

    const refresh = el('button', { marginTop: '14px', padding: '9px 16px', borderRadius: '9px', border: '1px solid rgba(62,189,248,.4)', background: 'transparent', color: SKY, fontWeight: '700', fontSize: '13px', cursor: 'pointer' }, '↻ Refresh')
    refresh.addEventListener('click', () => renderPage(root))
    root.appendChild(refresh)
  }

  function statCard (big, label, live) {
    const c = el('div', { padding: '16px 18px', borderRadius: '14px', border: '1px solid ' + (live ? 'rgba(239,68,68,.5)' : 'var(--border-primary,rgba(62,189,248,.25))'), background: live ? 'rgba(239,68,68,.07)' : 'var(--bg-secondary-400,#0f1729)' })
    c.appendChild(el('div', { fontSize: '30px', fontWeight: '800', lineHeight: '1.1' }, big))
    c.appendChild(el('div', { fontSize: '13px', color: 'var(--fg-350,#94a3b8)', marginTop: '4px' }, label))
    return c
  }

  function platformCard (name, icon, block, rows, connectPlatform) {
    const c = el('div', { padding: '16px 18px', borderRadius: '14px', border: '1px solid var(--border-primary,rgba(62,189,248,.25))', background: 'var(--bg-secondary-400,#0f1729)' })
    const head = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' })
    head.appendChild(el('span', { fontSize: '18px' }, icon))
    head.appendChild(el('div', { fontWeight: '750', fontSize: '16px' }, name))
    c.appendChild(head)

    if (block && block.connected === false) {
      c.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', fontSize: '14px', marginBottom: '12px' }, 'Not linked yet.'))
      const a = el('a', { display: 'inline-block', color: SKY, textDecoration: 'none', fontWeight: '700', fontSize: '14px' }, 'Connect ' + name + ' →')
      a.href = '/p/chat'
      c.appendChild(a)
      return c
    }
    if (block && block.error) {
      c.appendChild(el('div', { color: '#f0b429', fontSize: '13px', marginBottom: '10px' }, '⚠ ' + block.error))
    }
    rows.forEach(([lab, val, live]) => {
      const r = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid rgba(148,163,184,.12)' })
      r.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', fontSize: '13px' }, lab))
      const v = el('div', { fontWeight: '750', fontSize: '15px', color: live ? '#ef4444' : 'var(--fg,#e6edf5)' }, (live ? '🔴 ' : '') + fmt(val))
      r.appendChild(v); c.appendChild(r)
    })
    return c
  }

  // iife-free: nothing else to export
}

export { register }
