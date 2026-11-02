// Teknakul Invites — admin page. Invite people by email and optionally grant a plan
// (Free/Pro/Studio) with a lifetime or expiry date. Talks to the restream API, which
// enforces admin-only server-side; this UI also hides itself from non-admins.
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
        return result.concat([{ key: 'teknakul-invites', title: 'Teknakul',
          links: [{ label: 'Invites', shortLabel: 'Invites', path: '/p/invites', icon: 'users' }] }])
      } catch (e) { return result }
    }
  })

  registerClientRoute({ route: 'invites', onMount: ({ rootEl }) => render(rootEl) })

  function el (tag, style, text) {
    const e = document.createElement(tag)
    if (style) Object.assign(e.style, style)
    if (text != null) e.textContent = text
    return e
  }
  function inputStyle () { return { width: '100%', padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--border-primary,rgba(62,189,248,.3))', background: 'var(--input-bg,#0b1120)', color: 'var(--fg,#e6edf5)', fontSize: '14px', outline: 'none' } }
  function field (labelText, control) { const w = el('div'); w.appendChild(el('div', { fontSize: '12px', color: 'var(--fg-350,#94a3b8)', margin: '0 0 4px' }, labelText)); w.appendChild(control); return w }
  function btnGhost (color) { return { padding: '7px 13px', borderRadius: '8px', border: '1px solid rgba(62,189,248,.3)', background: 'transparent', color: color || SKY, fontWeight: '700', fontSize: '13px', cursor: 'pointer', flex: 'none' } }
  function chip (text, color) { return el('span', { fontSize: '12px', fontWeight: '700', color: color, border: '1px solid ' + color, borderRadius: '999px', padding: '2px 9px', flex: 'none' }, text) }

  async function render (root) {
    root.innerHTML = ''
    Object.assign(root.style, { maxWidth: '820px', margin: '0 auto', padding: '24px 18px', color: 'var(--fg,#e6edf5)' })
    root.appendChild(el('h1', { fontSize: '26px', fontWeight: '800', margin: '0 0 4px' }, '✉️ Invites'))
    root.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '20px', fontSize: '15px' },
      'Invite people by email and optionally set them up with a plan — lifetime or until a date.'))

    // admin gate
    let who
    try { who = await api('/admin/whoami') } catch (e) { who = { admin: false } }
    if (!who.admin) {
      root.appendChild(el('div', { border: '1px solid rgba(248,113,113,.4)', borderRadius: '14px', padding: '22px', background: 'rgba(248,113,113,.06)', color: '#f88' },
        'This page is for administrators only.'))
      return
    }

    // ---- add invite form ----
    const card = el('div', { border: '1px solid var(--border-primary,rgba(62,189,248,.25))', borderRadius: '14px', padding: '18px', marginBottom: '18px', background: 'var(--bg-secondary-400,#0f1729)' })
    card.appendChild(el('div', { fontWeight: '700', marginBottom: '12px' }, 'Send an invite'))
    const row = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' })

    const email = el('input', inputStyle()); email.type = 'email'; email.placeholder = 'person@example.com'
    const plan = el('select', inputStyle())
    ;[['free', 'Free (platform access only)'], ['pro', 'Pro'], ['studio', 'Studio']].forEach(([v, t]) => {
      const o = el('option', null, t); o.value = v; plan.appendChild(o)
    })
    const access = el('select', inputStyle())
    ;[['lifetime', 'Lifetime'], ['date', 'Until a date…']].forEach(([v, t]) => {
      const o = el('option', null, t); o.value = v; access.appendChild(o)
    })
    const expiry = el('input', inputStyle()); expiry.type = 'date'

    const planField = field('Plan', plan)
    const accessField = field('Access', access)
    const expiryField = field('Expiry date', expiry)
    function syncPlan () {
      const isFree = plan.value === 'free'
      accessField.style.display = isFree ? 'none' : ''
      expiryField.style.display = (isFree || access.value !== 'date') ? 'none' : ''
    }
    plan.addEventListener('change', syncPlan)
    access.addEventListener('change', syncPlan)

    row.appendChild(field('Email', email))
    row.appendChild(planField)
    row.appendChild(accessField)
    row.appendChild(expiryField)
    card.appendChild(row)

    const sendBtn = el('button', { marginTop: '12px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: SKY, color: '#0b1120', fontWeight: '700', cursor: 'pointer' }, 'Send invite')
    const msg = el('div', { marginTop: '10px', fontSize: '13px' })
    sendBtn.addEventListener('click', async () => {
      msg.textContent = ''; msg.style.color = '#f88'; sendBtn.disabled = true
      try {
        const expiresAt = (plan.value !== 'free' && access.value === 'date') ? expiry.value : ''
        if (plan.value !== 'free' && access.value === 'date' && !expiresAt) throw new Error('Pick an expiry date, or choose Lifetime.')
        const r = await api('/admin/invites', { method: 'POST', body: JSON.stringify({ email: email.value, plan: plan.value, expiresAt }) })
        msg.style.color = '#22c55e'
        msg.textContent = r.emailed ? ('Invite sent to ' + r.invite.email) : ('Invite created for ' + r.invite.email + ' — but the email could not be sent (check mail config).')
        email.value = ''
        renderList()
      } catch (e) { msg.style.color = '#f88'; msg.textContent = e.message } finally { sendBtn.disabled = false }
    })
    card.appendChild(sendBtn); card.appendChild(msg)
    root.appendChild(card)
    syncPlan()

    // ---- list ----
    const listWrap = el('div')
    root.appendChild(listWrap)

    async function renderList () {
      listWrap.innerHTML = ''
      let data
      try { data = await api('/admin/invites') } catch (e) {
        listWrap.appendChild(el('div', { color: '#f88' }, 'Could not load invites (' + e.message + ').')); return
      }
      const invites = data.invites || []
      listWrap.appendChild(el('div', { fontWeight: '700', margin: '6px 0 10px' }, 'Invites (' + invites.length + ')'))
      if (!invites.length) { listWrap.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)' }, 'No invites yet.')); return }
      invites.forEach(inv => {
        const it = el('div', { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid var(--border-primary,rgba(62,189,248,.2))', borderRadius: '12px', marginBottom: '8px', background: 'var(--bg-secondary-400,#0f1729)' })
        const info = el('div', { flex: '1', minWidth: '0' })
        info.appendChild(el('div', { fontWeight: '650', overflow: 'hidden', textOverflow: 'ellipsis' }, inv.email))
        const planTxt = inv.plan === 'free' ? 'Access only' : (inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1) + (inv.expiresAt ? (' · until ' + inv.expiresAt.slice(0, 10)) : ' · lifetime'))
        info.appendChild(el('div', { fontSize: '12px', color: 'var(--fg-350,#94a3b8)' }, planTxt + (inv.grantedUsername ? ('  ·  @' + inv.grantedUsername) : '')))
        const statusColor = inv.status === 'accepted' ? '#22c55e' : (inv.status === 'revoked' ? '#64748b' : SKY)
        it.appendChild(info)
        it.appendChild(chip(inv.status, statusColor))
        if (inv.status === 'pending') {
          const resend = el('button', btnGhost(), 'Resend')
          resend.addEventListener('click', async () => { resend.disabled = true; try { await api('/admin/invites/' + inv.id + '/resend', { method: 'POST' }) } catch (e) {} ; renderList() })
          const revoke = el('button', btnGhost('#f88'), 'Revoke')
          revoke.addEventListener('click', async () => { revoke.disabled = true; try { await api('/admin/invites/' + inv.id, { method: 'DELETE' }) } catch (e) {} ; renderList() })
          it.appendChild(resend); it.appendChild(revoke)
        }
        listWrap.appendChild(it)
      })
    }
    renderList()
  }
}

export { register }
