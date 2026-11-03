// Multistream destinations manager (Pro-gated). Registers a /p/multistream route and a
// left-menu link. Talks to the restream API (Cloudflare route -> linuxg1:3082), which
// stores destinations (keys encrypted) and fans your live out to each platform.
async function register ({ registerHook, registerClientRoute, peertubeHelpers }) {
  const SKY = '#3ebdf8'
  const API = (window.TEKNAKUL_RESTREAM_API || 'https://restream.teknakul.com').replace(/\/$/, '')
  const PLATFORMS = {
    twitch:   'rtmp://live.twitch.tv/app',
    youtube:  'rtmp://a.rtmp.youtube.com/live2',
    facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',  // stable RTMPS ingest; key only
    kick:     '',   // Kick provides a full rtmps ingest URL per user
    telegram: '',   // Telegram provides a per-user rtmps server URL (rtmps://dcN-1.rtmp.t.me/s/)
    rumble:   '',   // Rumble Studio Direct RTMP room mints its own stream URL + key
    linkedin: '',   // LinkedIn Live event mints an RTMP(S) URL + key ~10 min before start
    tiktok:   '',   // TikTok LIVE Producer mints a per-session server URL + key
    custom:   ''
  }
  // Proper brand casing for the dropdown (auto-capitalise is wrong for these).
  const LABELS = { youtube: 'YouTube', linkedin: 'LinkedIn', tiktok: 'TikTok' }
  // Short, platform-specific guidance shown under the add form.
  const HINTS = {
    twitch:   'Twitch → Creator Dashboard → Settings → Stream. Paste your primary Stream Key below.',
    youtube:  'YouTube Studio → Go Live → Stream. Paste the Stream Key below (the server is already set).',
    facebook: 'Facebook → Live Producer → “Use stream key”. Turn on “Persistent stream key” so it doesn’t change each time, then paste the Stream Key below (the server is already set).',
    kick:     'Kick → Settings → Stream Key. Paste the full rtmps server URL into RTMP server and the key below.',
    telegram: 'In Telegram open your channel → ⋮ menu → Live Stream → “Stream With…”. Copy the Server URL (rtmps://…t.me/s/) into RTMP server and the Stream Key below. The channel must be live-streaming for the relay to connect.',
    rumble:   'Rumble → Studio → create a Direct RTMP room. Copy that room’s Stream URL into RTMP server and the key below. (Needs a Rumble account with livestreaming enabled.)',
    linkedin: 'LinkedIn Live needs approved Live access. Create your LinkedIn Live event, then ~10 min before start generate the RTMP URL + key in LinkedIn’s Live Studio and paste them below.',
    tiktok:   'TikTok LIVE via RTMP needs LIVE access (about 1,000 followers). In TikTok Live Producer (desktop) add a title + category → Save & Go LIVE to reveal the Server URL and Stream Key, then paste them below.',
    custom:   'Paste the rtmp:// or rtmps:// server URL and stream key from your platform.'
  }

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

  // ---- left-menu link ------------------------------------------------------
  registerHook({
    target: 'filter:left-menu.links.create.result',
    handler: (result) => {
      try {
        const links = [{ label: 'Multistream', shortLabel: 'Multistream', path: '/p/multistream', icon: 'live' }]
        return result.concat([{ key: 'teknakul-multistream', title: 'Teknakul', links }])
      } catch (e) { return result }
    }
  })

  // ---- the page ------------------------------------------------------------
  registerClientRoute({
    route: 'multistream',
    onMount: ({ rootEl }) => { renderPage(rootEl) }
  })

  function el (tag, style, text) {
    const e = document.createElement(tag)
    if (style) Object.assign(e.style, style)
    if (text != null) e.textContent = text
    return e
  }

  async function renderPage (root) {
    root.innerHTML = ''
    Object.assign(root.style, { maxWidth: '760px', margin: '0 auto', padding: '24px 18px', color: 'var(--fg,#e6edf5)' })

    const h = el('h1', { fontSize: '26px', fontWeight: '800', margin: '0 0 4px' }, '📡 Multistream')
    const sub = el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '20px', fontSize: '15px' },
      'Stream once to Teknakul — we relay it live to every platform you add below.')
    root.appendChild(h); root.appendChild(sub)

    let state
    try { state = await api('/destinations') } catch (e) {
      root.appendChild(el('div', { color: '#f88' }, 'Could not load multistream (' + e.message + ').'))
      return
    }

    if (!state.max || state.max <= 0) {
      const up = el('div', { border: '1px solid rgba(62,189,248,.35)', borderRadius: '14px', padding: '22px', background: 'rgba(62,189,248,.06)' })
      up.appendChild(el('div', { fontWeight: '700', fontSize: '17px', marginBottom: '6px' }, 'Multistreaming is a Pro feature'))
      up.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '16px' }, 'Broadcast to Twitch, YouTube, Facebook, Telegram, Rumble, Kick, LinkedIn and TikTok at the same time — from your desk or your phone. Stream once, reach everywhere.'))
      async function checkout (plan) {
        try {
          const d = await api('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) })
          if (d.url) window.location.href = d.url
        } catch (e) { alert('Could not start checkout: ' + e.message) }
      }
      const btnRow = el('div', { display: 'flex', gap: '10px', flexWrap: 'wrap' })
      const pro = el('button', { padding: '11px 20px', borderRadius: '10px', border: 'none', background: SKY, color: '#0b1120', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }, 'Upgrade to Pro — $20/mo')
      pro.addEventListener('click', () => checkout('pro'))
      const studio = el('button', { padding: '11px 20px', borderRadius: '10px', border: '1px solid rgba(62,189,248,.4)', background: 'transparent', color: 'var(--fg,#e6edf5)', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }, 'Go Studio — $49/mo')
      studio.addEventListener('click', () => checkout('studio'))
      btnRow.appendChild(pro); btnRow.appendChild(studio)
      up.appendChild(btnRow)
      const a = el('a', { display: 'inline-block', marginTop: '12px', color: SKY, textDecoration: 'none', fontSize: '13px' }, 'Compare all plans →')
      a.href = 'https://www.teknakul.com/pricing.html'
      up.appendChild(a); root.appendChild(up); return
    }

    // ---- add form ----
    const card = el('div', { border: '1px solid var(--border-primary,rgba(62,189,248,.25))', borderRadius: '14px', padding: '18px', marginBottom: '18px', background: 'var(--bg-secondary-400,#0f1729)' })
    card.appendChild(el('div', { fontWeight: '700', marginBottom: '12px' }, 'Add a destination'))
    const row = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' })
    const platform = el('select', inputStyle())
    ;['twitch', 'youtube', 'facebook', 'telegram', 'rumble', 'kick', 'linkedin', 'tiktok', 'custom'].forEach(p => {
      const o = el('option', null, LABELS[p] || (p.charAt(0).toUpperCase() + p.slice(1))); o.value = p; platform.appendChild(o)
    })
    const label = mkInput('Label (e.g. My Twitch)')
    const rtmp = mkInput('rtmp:// server URL')
    const key = mkInput('Stream key'); key.type = 'password'
    const hint = el('div', { marginTop: '8px', fontSize: '12px', color: 'var(--fg-350,#94a3b8)', lineHeight: '1.5' })
    // A fixed preset (Twitch/YouTube) locks the server field; platforms that mint a
    // per-user ingest URL (Kick, Telegram) or custom leave it editable.
    function syncRtmp () {
      const preset = PLATFORMS[platform.value] || ''
      rtmp.value = preset
      rtmp.disabled = !!preset
      hint.textContent = HINTS[platform.value] || ''
    }
    platform.addEventListener('change', syncRtmp); syncRtmp()
    row.appendChild(field('Platform', platform)); row.appendChild(field('Label', label))
    row.appendChild(field('RTMP server', rtmp)); row.appendChild(field('Stream key', key))
    card.appendChild(row)
    card.appendChild(hint)
    const addBtn = el('button', { marginTop: '12px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: SKY, color: '#0b1120', fontWeight: '700', cursor: 'pointer' }, 'Add destination')
    const msg = el('div', { marginTop: '10px', fontSize: '13px', color: '#f88' })
    addBtn.addEventListener('click', async () => {
      msg.textContent = ''; addBtn.disabled = true
      try {
        state = await api('/destinations', { method: 'POST', body: JSON.stringify({
          platform: platform.value, label: label.value, rtmpUrl: rtmp.value, streamKey: key.value
        }) })
        label.value = ''; key.value = ''; renderList()
      } catch (e) { msg.textContent = e.message } finally { addBtn.disabled = false }
    })
    card.appendChild(addBtn); card.appendChild(msg)
    root.appendChild(card)

    const listWrap = el('div')
    root.appendChild(listWrap)
    const foot = el('div', { marginTop: '16px', fontSize: '13px', color: 'var(--fg-350,#94a3b8)' })
    root.appendChild(foot)

    function renderList () {
      listWrap.innerHTML = ''
      const dests = (state.destinations || [])
      foot.textContent = `Plan: ${state.plan} · ${dests.length}/${state.max} destinations used. They go live automatically the next time you broadcast.`
      if (!dests.length) { listWrap.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)' }, 'No destinations yet — add one above.')); return }
      dests.forEach(d => {
        const it = el('div', { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid var(--border-primary,rgba(62,189,248,.2))', borderRadius: '12px', marginBottom: '8px', background: 'var(--bg-secondary-400,#0f1729)' })
        const dot = el('span', { width: '9px', height: '9px', borderRadius: '50%', flex: 'none', background: d.enabled ? '#22c55e' : '#64748b' })
        const info = el('div', { flex: '1' })
        info.appendChild(el('div', { fontWeight: '650' }, d.label + '  ·  ' + d.platform))
        info.appendChild(el('div', { fontSize: '12px', color: 'var(--fg-350,#94a3b8)' }, d.rtmpUrl + '  ·  key ' + d.streamKey))
        const tgl = el('button', btnGhost(), d.enabled ? 'Disable' : 'Enable')
        tgl.addEventListener('click', async () => { state = await api('/destinations/' + d.id + '/toggle', { method: 'POST' }); renderList() })
        const del = el('button', btnGhost('#f88'), 'Remove')
        del.addEventListener('click', async () => { state = await api('/destinations/' + d.id, { method: 'DELETE' }); renderList() })
        it.appendChild(dot); it.appendChild(info); it.appendChild(tgl); it.appendChild(del)
        listWrap.appendChild(it)
      })
    }
    renderList()
  }

  function inputStyle () { return { width: '100%', padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--border-primary,rgba(62,189,248,.3))', background: 'var(--input-bg,#0b1120)', color: 'var(--fg,#e6edf5)', fontSize: '14px', outline: 'none' } }
  function mkInput (ph) { const i = el('input', inputStyle()); i.placeholder = ph; return i }
  function field (labelText, control) { const w = el('div'); w.appendChild(el('div', { fontSize: '12px', color: 'var(--fg-350,#94a3b8)', margin: '0 0 4px' }, labelText)); w.appendChild(control); return w }
  function btnGhost (color) { return { padding: '7px 13px', borderRadius: '8px', border: '1px solid rgba(62,189,248,.3)', background: 'transparent', color: color || '#3ebdf8', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flex: 'none' } }
}

export { register }
