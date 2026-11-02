// Teknakul Go — browser/phone WebRTC (WHIP) go-live page.
// Captures camera+mic, asks the restream API to create a live (returns the WHIP url),
// publishes via WHIP to the gateway (which pushes it into Teknakul), and — if the
// creator is Pro — the restream engine fans it out to every destination. Registers a
// /p/go route + a "Go Live" menu link.
async function register ({ registerHook, registerClientRoute, peertubeHelpers }) {
  const SKY = '#3ebdf8'
  const API = (window.TEKNAKUL_RESTREAM_API || 'https://restream.teknakul.com').replace(/\/$/, '')

  registerHook({
    target: 'filter:left-menu.links.create.result',
    handler: (result) => {
      try {
        return result.concat([{ key: 'teknakul-go', title: 'Teknakul',
          links: [{ label: 'Go Live', shortLabel: 'Go Live', path: '/p/go', icon: 'live' }] }])
      } catch (e) { return result }
    }
  })

  registerClientRoute({ route: 'go', onMount: ({ rootEl }) => render(rootEl) })

  function el (tag, style, text) {
    const e = document.createElement(tag)
    if (style) Object.assign(e.style, style)
    if (text != null) e.textContent = text
    return e
  }

  // Resolve when the media connection is actually established; reject with a
  // human message if it fails or never connects within `ms`.
  function waitConnected (pc, ms) {
    return new Promise((res, rej) => {
      const done = (fn, arg) => { pc.removeEventListener('connectionstatechange', cb); clearTimeout(timer); fn(arg) }
      const cb = () => {
        const s = pc.connectionState
        if (s === 'connected') done(res)
        else if (s === 'failed' || s === 'closed') done(rej, new Error('the video connection could not be established (the server media port may be unreachable from this network)'))
      }
      if (pc.connectionState === 'connected') return res()
      pc.addEventListener('connectionstatechange', cb)
      const timer = setTimeout(() => done(rej, new Error('timed out connecting the video (no media path to the server from this network)')), ms)
    })
  }

  function iceComplete (pc) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res()
      const cb = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', cb); res() } }
      pc.addEventListener('icegatheringstatechange', cb)
      setTimeout(res, 3000) // don't wait forever for host candidates
    })
  }

  async function render (root) {
    root.innerHTML = ''
    Object.assign(root.style, { maxWidth: '720px', margin: '0 auto', padding: '24px 18px', color: 'var(--fg,#e6edf5)' })
    root.appendChild(el('h1', { fontSize: '26px', fontWeight: '800', margin: '0 0 4px' }, '🔴 Go Live'))
    root.appendChild(el('div', { color: 'var(--fg-350,#94a3b8)', marginBottom: '18px', fontSize: '15px' },
      'Stream straight from this device. If multistream is set up, you go out everywhere at once.'))

    // Video stage — wraps the preview so it can expand to fill the whole
    // screen on a phone (iOS Safari ignores <video> fullscreen for a muted
    // preview, so we use a fixed full-viewport overlay instead).
    const stage = el('div', { position: 'relative', width: '100%', borderRadius: '14px', overflow: 'hidden', background: '#000', aspectRatio: '16/9' })
    const video = el('video', { width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: 'block' })
    video.autoplay = true; video.muted = true; video.playsInline = true
    const fsBtn = el('button', { position: 'absolute', top: '10px', right: '10px', width: '40px', height: '40px', borderRadius: '10px', border: 'none', background: 'rgba(11,17,32,.6)', color: '#fff', fontSize: '18px', lineHeight: '40px', cursor: 'pointer', zIndex: '2', padding: '0' }, '⛶')
    fsBtn.setAttribute('aria-label', 'Toggle full screen')
    stage.appendChild(video); stage.appendChild(fsBtn)
    root.appendChild(stage)

    let fs = false
    function setFs (on) {
      fs = on
      if (on) {
        // Full-viewport overlay. iOS Safari ignores the Fullscreen API on non-video elements,
        // so we expand the stage ourselves. Use 100dvh (falls back to 100vh) so the iOS toolbars
        // don't crop it, max z-index so nothing sits on top, and a safe-area inset so the close
        // button clears the notch / Dynamic Island.
        Object.assign(stage.style, { position: 'fixed', inset: '0', width: '100vw', borderRadius: '0', aspectRatio: 'auto', zIndex: '2147483647', background: '#000' })
        stage.style.height = '100vh'
        stage.style.height = '100dvh'
        Object.assign(fsBtn.style, { top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 'calc(env(safe-area-inset-right, 0px) + 12px)' })
        document.body.style.overflow = 'hidden'
        fsBtn.textContent = '✕'; fsBtn.setAttribute('aria-label', 'Exit full screen')
      } else {
        Object.assign(stage.style, { position: 'relative', inset: '', width: '100%', height: '', borderRadius: '14px', aspectRatio: '16/9', zIndex: '', background: '#000' })
        Object.assign(fsBtn.style, { top: '10px', right: '10px' })
        document.body.style.overflow = ''
        fsBtn.textContent = '⛶'; fsBtn.setAttribute('aria-label', 'Full screen')
      }
    }
    function toggleFs () {
      // Prefer real device fullscreen where it works (Android/desktop); fall back to the overlay.
      const req = stage.requestFullscreen || stage.webkitRequestFullscreen
      const exit = document.exitFullscreen || document.webkitExitFullscreen
      const native = document.fullscreenElement || document.webkitFullscreenElement
      try {
        if (!fs && !native && req) { req.call(stage); return }   // onFsChange flips the button
        if (fs && native && exit) { exit.call(document); return }
      } catch (_) { /* fall back to the CSS overlay */ }
      setFs(!fs)
    }
    function onFsChange () {
      const active = !!(document.fullscreenElement || document.webkitFullscreenElement)
      fsBtn.textContent = active ? '✕' : '⛶'
      fsBtn.setAttribute('aria-label', active ? 'Exit full screen' : 'Full screen')
      fs = active
      if (active) document.body.style.overflow = 'hidden'
      else document.body.style.overflow = ''
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    fsBtn.addEventListener('click', toggleFs)

    const title = el('input', { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(62,189,248,.3)', background: 'var(--input-bg,#0b1120)', color: 'var(--fg,#e6edf5)', margin: '12px 0', fontSize: '14px', outline: 'none' })
    title.placeholder = 'Stream title'; title.value = 'Live from Teknakul Go'
    root.appendChild(title)

    const btn = el('button', { padding: '12px 24px', borderRadius: '11px', border: 'none', background: SKY, color: '#0b1120', fontWeight: '800', fontSize: '16px', cursor: 'pointer' }, 'Go Live')
    const status = el('div', { marginTop: '14px', fontSize: '14px', lineHeight: '1.6' })
    root.appendChild(btn); root.appendChild(status)

    let stream, pc, resourceUrl, live = false
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      video.srcObject = stream
    } catch (e) {
      status.style.color = '#f88'
      status.textContent = 'Camera/mic permission is required to go live. (' + e.message + ')'
      return
    }

    async function goLive () {
      btn.disabled = true; status.style.color = ''; status.textContent = 'Starting…'
      try {
        const h = (peertubeHelpers.getAuthHeader && peertubeHelpers.getAuthHeader()) || {}
        const res = await fetch(API + '/go/start', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h), body: JSON.stringify({ name: title.value }) })
        const info = await res.json()
        if (!res.ok) throw new Error(info.error || 'could not start the live')
        status.textContent = 'Connecting…'
        // Use the STUN+TURN servers the API hands us (TURN relays media so cellular/NAT
        // connects reliably); fall back to public STUN if none were provided.
        const ice = (info.iceServers && info.iceServers.length) ? info.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }]
        pc = new RTCPeerConnection({ iceServers: ice })
        stream.getTracks().forEach(t => pc.addTrack(t, stream))
        await pc.setLocalDescription(await pc.createOffer())
        await iceComplete(pc)
        const whip = await fetch(info.whipUrl, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp })
        if (!whip.ok) throw new Error('the streaming gateway rejected the connection (' + whip.status + ')')
        const loc = whip.headers.get('Location')
        if (loc) { try { resourceUrl = new URL(loc, info.whipUrl).href } catch (e) { resourceUrl = loc } }
        await pc.setRemoteDescription({ type: 'answer', sdp: await whip.text() })
        // The WHIP handshake is done, but media has NOT connected yet. Don't
        // claim LIVE until the peer connection actually reaches 'connected' —
        // otherwise a blocked media path shows a false "You are LIVE" while
        // nothing is broadcasting. Surface a real error if it never connects.
        status.textContent = 'Connecting media…'
        await waitConnected(pc, 20000)
        live = true
        status.innerHTML = ''
        status.appendChild(el('div', { color: '#22c55e', fontWeight: '700' },
          '🔴 You are LIVE' + (info.multistream ? ' — multistreaming to your destinations' : '')))
        const a = el('a', { color: SKY, display: 'inline-block', marginTop: '4px' }, 'Open your stream ↗')
        a.href = info.watchUrl; a.target = '_blank'; status.appendChild(a)
        btn.textContent = 'Stop'; btn.style.background = '#ef4444'; btn.style.color = '#fff'; btn.disabled = false
      } catch (e) {
        try { if (pc && !live) { pc.close(); pc = null } } catch (_) { /* ignore */ }
        status.style.color = '#f88'; status.textContent = 'Could not go live: ' + e.message
        btn.disabled = false
      }
    }

    async function stop () {
      live = false
      try { if (resourceUrl) await fetch(resourceUrl, { method: 'DELETE' }) } catch (e) { /* ignore */ }
      try { if (pc) pc.close() } catch (e) { /* ignore */ }
      status.style.color = ''; status.textContent = 'Stream ended.'
      btn.textContent = 'Go Live'; btn.style.background = SKY; btn.style.color = '#0b1120'
    }

    btn.addEventListener('click', () => (live ? stop() : goLive()))
  }
}

export { register }
