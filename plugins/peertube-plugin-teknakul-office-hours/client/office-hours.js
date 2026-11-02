// Teknakul Office Hours — public schedule of live mentoring sessions + a creator
// scheduling form. Talks to the restream API; public list is open, scheduling needs sign-in.
async function register ({ registerHook, registerClientRoute, peertubeHelpers }) {
  const SKY = '#3ebdf8'
  const API = (window.TEKNAKUL_RESTREAM_API || 'https://restream.teknakul.com').replace(/\/$/, '')

  function authHeader () {
    return (peertubeHelpers.getAuthHeader && peertubeHelpers.getAuthHeader()) || null
  }
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
        return result.concat([{ key: 'teknakul-office-hours', title: 'Teknakul',
          links: [{ label: 'Office Hours', shortLabel: 'Office Hours', path: '/p/office-hours', icon: 'support' }] }])
      } catch (e) { return result }
    }
  })

  registerClientRoute({ route: 'office-hours', onMount: ({ rootEl }) => render(rootEl) })

  function el (tag, style, text) {
    const e = document.createElement(tag)
    if (style) Object.assign(e.style, style)
    if (text != null) e.textContent = text
    return e
  }
  function inputStyle () { return { width: '100%', padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--border-primary,rgba(62,189,248,.3))', background: 'var(--input-bg,#0b1120)', color: 'var(--fg,#e6edf5)', fontSize: '14px', outline: 'none' } }
  function field (labelText, control) { const w = el('div'); w.appendChild(el('div', { fontSize: '12px', color: 'var(--fg-350,#94a3b8)', margin: '0 0 4px' }, labelText)); w.appendChild(control); return w }
  function btnGhost (color) { return { padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(62,189,248,.3)', background: 'transparent', color: color || SKY, fontWeight: '700', fontSize: '12px', cursor: 'pointer', flex: 'none' } }

  function fmtWhen (iso) {
    try {
      const d = new Date(iso)
      return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    } catch (e) { return iso }
  }

  async function render (root) {
    root.innerHTML = ''
    Object.assign(root.style, { maxWidth: '820px', margin: '0 auto', padding: '24px 18px', color: 'var(--fg,#e6edf5)' })
    root.appendChild(el('h1', { fontSize: '26px', fontWeight: '800', margin: '0 0 4px' }, '🎓 Office Hours'))
    root.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '20px', fontSize: '15px' },
      'Live mentoring and Q&A sessions from Teknakul creators. Add one to your calendar and show up with questions.'))

    const signedIn = !!authHeader()

    // ---- schedule form (signed-in creators) ----
    if (signedIn) {
      const card = el('div', { border: '1px solid var(--border-primary,rgba(62,189,248,.25))', borderRadius: '14px', padding: '18px', marginBottom: '20px', background: 'var(--bg-secondary-400,#0f1729)' })
      card.appendChild(el('div', { fontWeight: '700', marginBottom: '12px' }, 'Schedule a session'))
      const title = el('input', inputStyle()); title.placeholder = 'e.g. Intune office hours — bring your enrollment questions'
      const desc = el('textarea', Object.assign(inputStyle(), { minHeight: '58px', resize: 'vertical' })); desc.placeholder = 'What you’ll cover (optional)'
      const when = el('input', inputStyle()); when.type = 'datetime-local'
      const dur = el('select', inputStyle())
      ;[['30', '30 minutes'], ['45', '45 minutes'], ['60', '1 hour'], ['90', '90 minutes'], ['120', '2 hours']].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; dur.appendChild(o) })
      dur.value = '60'
      const grid = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' })
      grid.appendChild(field('When', when)); grid.appendChild(field('Length', dur))
      card.appendChild(field('Title', title))
      card.appendChild(field('Details', desc))
      card.appendChild(grid)
      const btn = el('button', { marginTop: '12px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: SKY, color: '#0b1120', fontWeight: '700', cursor: 'pointer' }, 'Schedule')
      const msg = el('div', { marginTop: '10px', fontSize: '13px' })
      btn.addEventListener('click', async () => {
        msg.textContent = ''; msg.style.color = '#f88'; btn.disabled = true
        try {
          if (!title.value.trim()) throw new Error('Add a title.')
          if (!when.value) throw new Error('Pick a date and time.')
          const startsAt = new Date(when.value).toISOString()
          await api('/office-hours', { method: 'POST', auth: true, body: JSON.stringify({ title: title.value, description: desc.value, startsAt, durationMin: parseInt(dur.value, 10) }) })
          msg.style.color = '#22c55e'; msg.textContent = 'Scheduled!'
          title.value = ''; desc.value = ''; when.value = ''
          loadList()
        } catch (e) { msg.style.color = '#f88'; msg.textContent = e.message } finally { btn.disabled = false }
      })
      card.appendChild(btn); card.appendChild(msg)
      root.appendChild(card)
    } else {
      root.appendChild(el('div', { fontSize: '13px', color: 'var(--fg-350,#94a3b8)', marginBottom: '16px' }, 'Sign in to schedule your own office hours.'))
    }

    const listWrap = el('div')
    root.appendChild(listWrap)

    async function loadList () {
      listWrap.innerHTML = ''
      let data, mine = []
      try { data = await api('/office-hours') } catch (e) {
        listWrap.appendChild(el('div', { color: '#f88' }, 'Could not load the schedule (' + e.message + ').')); return
      }
      if (signedIn) { try { mine = (await api('/office-hours/mine', { auth: true })).sessions || [] } catch (e) {} }
      const mineIds = new Set(mine.filter(s => s.status === 'scheduled').map(s => s.id))
      const sessions = data.sessions || []
      listWrap.appendChild(el('div', { fontWeight: '700', margin: '6px 0 10px' }, 'Upcoming (' + sessions.length + ')'))
      if (!sessions.length) { listWrap.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)' }, 'No sessions scheduled yet.')); return }
      sessions.forEach(s => {
        const it = el('div', { padding: '14px 16px', border: '1px solid var(--border-primary,rgba(62,189,248,.2))', borderRadius: '12px', marginBottom: '10px', background: 'var(--bg-secondary-400,#0f1729)' })
        const head = el('div', { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' })
        head.appendChild(el('div', { fontWeight: '700', fontSize: '15px' }, s.title))
        head.appendChild(el('div', { fontSize: '12px', color: SKY, fontWeight: '700' }, fmtWhen(s.startsAt) + ' · ' + s.durationMin + ' min'))
        it.appendChild(head)
        it.appendChild(el('div', { fontSize: '13px', color: 'var(--fg-350,#94a3b8)', margin: '4px 0 2px' }, 'with ' + s.host))
        if (s.description) it.appendChild(el('div', { fontSize: '13.5px', margin: '6px 0' }, s.description))
        const actions = el('div', { display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' })
        const cal = el('a', Object.assign(btnGhost(), { textDecoration: 'none', display: 'inline-block' }), '📅 Add to calendar')
        cal.href = API + '/office-hours/' + s.id + '.ics'
        actions.appendChild(cal)
        if (s.channel) {
          const ch = el('a', Object.assign(btnGhost(), { textDecoration: 'none', display: 'inline-block' }), '▶ Visit channel')
          ch.href = '/c/' + s.channel; actions.appendChild(ch)
        }
        if (mineIds.has(s.id)) {
          const cancel = el('button', btnGhost('#f88'), 'Cancel')
          cancel.addEventListener('click', async () => { cancel.disabled = true; try { await api('/office-hours/' + s.id, { method: 'DELETE', auth: true }) } catch (e) {} loadList() })
          actions.appendChild(cancel)
        }
        it.appendChild(actions)
        listWrap.appendChild(it)
      })
    }
    loadList()
  }
}

export { register }
