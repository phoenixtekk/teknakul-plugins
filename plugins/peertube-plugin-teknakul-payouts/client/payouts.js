// Teknakul Payouts & Memberships (Stripe Connect).
//  /p/payouts    — creator: set up payouts (Express onboarding), see status, set a monthly price.
//  /p/membership — viewer: become a member of a creator (?creator=username).
async function register ({ registerHook, registerClientRoute, peertubeHelpers }) {
  const SKY = '#3ebdf8'
  const API = (window.TEKNAKUL_RESTREAM_API || 'https://restream.teknakul.com').replace(/\/$/, '')

  function authHeader () { return (peertubeHelpers.getAuthHeader && peertubeHelpers.getAuthHeader()) || null }
  async function api (path, opts) {
    const o = opts || {}
    const h = Object.assign({ 'Content-Type': 'application/json' }, o.auth ? (authHeader() || {}) : {})
    const res = await fetch(API + path, Object.assign({}, o, { headers: h }))
    let data = {}
    try { data = await res.json() } catch (e) {}
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status))
    return data
  }

  registerHook({
    target: 'filter:left-menu.links.create.result',
    handler: (result) => {
      try {
        return result.concat([{ key: 'teknakul-payouts', title: 'Teknakul',
          links: [{ label: 'Payouts', shortLabel: 'Payouts', path: '/p/payouts', icon: 'wallet' }] }])
      } catch (e) { return result }
    }
  })

  registerClientRoute({ route: 'payouts', onMount: ({ rootEl }) => renderPayouts(rootEl) })
  registerClientRoute({ route: 'membership', onMount: ({ rootEl }) => renderMembership(rootEl) })

  function el (tag, style, text) {
    const e = document.createElement(tag)
    if (style) Object.assign(e.style, style)
    if (text != null) e.textContent = text
    return e
  }
  const card = () => el('div', { border: '1px solid rgba(62,189,248,.25)', borderRadius: '14px', padding: '18px', marginBottom: '16px', background: 'var(--bg-secondary-400,#0f1729)' })
  const primaryBtn = (t) => el('button', { padding: '11px 22px', borderRadius: '10px', border: 'none', background: SKY, color: '#0b1120', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }, t)
  function wrap (root, title, sub) {
    root.innerHTML = ''
    Object.assign(root.style, { maxWidth: '720px', margin: '0 auto', padding: '24px 18px', color: 'var(--fg,#e6edf5)' })
    root.appendChild(el('h1', { fontSize: '26px', fontWeight: '800', margin: '0 0 4px' }, title))
    if (sub) root.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '18px', fontSize: '15px' }, sub))
  }

  // ---------- creator: payouts ----------
  async function renderPayouts (root) {
    wrap(root, '💳 Payouts & Memberships', 'Get paid by your audience. Set up payouts, then set a monthly membership price — Teknakul keeps a small platform fee, the rest is yours.')
    if (!authHeader()) { root.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)' }, 'Sign in to set up payouts.')); return }
    let st
    try { st = await api('/connect/status', { auth: true }) } catch (e) {
      root.appendChild(el('div', { color: '#f88' }, 'Could not load payout status (' + e.message + ').')); return
    }
    const c = card()
    if (!st.connected || !st.payoutsEnabled || !st.chargesEnabled) {
      c.appendChild(el('div', { fontWeight: '700', marginBottom: '6px' }, st.connected ? 'Finish your payout setup' : 'Set up payouts'))
      c.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '14px', fontSize: '14px' }, 'Stripe handles onboarding, identity, and bank details securely. You can come back any time.'))
      const btn = primaryBtn(st.connected ? 'Continue setup →' : 'Set up payouts with Stripe →')
      const msg = el('div', { marginTop: '10px', fontSize: '13px', color: '#f88' })
      btn.addEventListener('click', async () => {
        btn.disabled = true; msg.textContent = ''
        try { const r = await api('/connect/onboard', { method: 'POST', auth: true }); if (r.url) window.location.href = r.url; else throw new Error('no onboarding link') }
        catch (e) { msg.textContent = e.message; btn.disabled = false }
      })
      c.appendChild(btn); c.appendChild(msg)
      root.appendChild(c)
      return
    }
    // payouts active -> membership price
    c.appendChild(el('div', { fontWeight: '700', color: '#22c55e', marginBottom: '4px' }, '✓ Payouts active'))
    c.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', fontSize: '14px', marginBottom: '14px' }, 'Your account can receive membership payouts.'))
    const label = el('div', { fontSize: '12px', color: 'var(--fg-350,#94a3b8)', marginBottom: '4px' }, 'Monthly membership price (USD)')
    const row = el('div', { display: 'flex', gap: '8px', alignItems: 'center' })
    const price = el('input', { width: '140px', padding: '9px 11px', borderRadius: '9px', border: '1px solid rgba(62,189,248,.3)', background: '#0b1120', color: '#e6edf5', fontSize: '14px' })
    price.type = 'number'; price.min = '1'; price.step = '1'; price.value = st.priceCents ? (st.priceCents / 100) : '5'
    const save = primaryBtn('Save price')
    const msg = el('div', { marginTop: '10px', fontSize: '13px' })
    save.addEventListener('click', async () => {
      msg.textContent = ''; msg.style.color = '#f88'; save.disabled = true
      try {
        const cents = Math.round(parseFloat(price.value) * 100)
        await api('/connect/price', { method: 'POST', auth: true, body: JSON.stringify({ priceCents: cents }) })
        msg.style.color = '#22c55e'; msg.textContent = 'Saved — your channel can now take memberships.'
      } catch (e) { msg.style.color = '#f88'; msg.textContent = e.message } finally { save.disabled = false }
    })
    row.appendChild(el('span', { fontSize: '16px' }, '$')); row.appendChild(price); row.appendChild(save)
    c.appendChild(label); c.appendChild(row); c.appendChild(msg)
    root.appendChild(c)
    if (st.priceCents) root.appendChild(el('div', { fontSize: '13px', color: 'var(--fg-350,#94a3b8)' }, 'Share your channel — viewers can join at /p/membership?creator=<your-username>.'))
  }

  // ---------- viewer: membership ----------
  async function renderMembership (root) {
    const params = new URLSearchParams(window.location.search)
    const creator = (params.get('creator') || '').trim()
    wrap(root, '⭐ Become a member', creator ? ('Support @' + creator + ' with a monthly membership.') : 'Support a Teknakul creator with a monthly membership.')
    if (!authHeader()) { root.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)' }, 'Sign in to become a member.')); return }
    const c = card()
    if (!creator) {
      c.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)' }, 'Open a creator’s channel and use their “Become a member” link, or add ?creator=<username> to this page.'))
      root.appendChild(c)
    } else {
      c.appendChild(el('div', { fontWeight: '700', marginBottom: '10px' }, 'Membership for @' + creator))
      const btn = primaryBtn('Become a member →')
      const msg = el('div', { marginTop: '10px', fontSize: '13px', color: '#f88' })
      btn.addEventListener('click', async () => {
        btn.disabled = true; msg.textContent = ''
        try { const r = await api('/memberships/checkout', { method: 'POST', auth: true, body: JSON.stringify({ creator }) }); if (r.url) window.location.href = r.url; else throw new Error('could not start checkout') }
        catch (e) { msg.textContent = e.message; btn.disabled = false }
      })
      c.appendChild(btn); c.appendChild(msg)
      root.appendChild(c)
    }
    try {
      const mine = (await api('/memberships/mine', { auth: true })).memberships || []
      if (mine.length) {
        const m = el('div', { marginTop: '8px' })
        m.appendChild(el('div', { fontWeight: '700', margin: '6px 0' }, 'Your memberships'))
        mine.forEach(x => m.appendChild(el('div', { fontSize: '14px', color: 'var(--fg-350,#94a3b8)' }, '⭐ @' + x.creator + ' — ' + x.status)))
        root.appendChild(m)
      }
    } catch (e) {}
  }
}

export { register }
