// Teknakul Brand — rebrands residual "PeerTube" UI text to "Teknakul".
// PeerTube's Angular client hardcodes some brand strings (the admin "Welcome to PeerTube"
// dialog, menu/About copy) that aren't exposed as instance settings. This client script
// replaces the visible word "PeerTube" with "Teknakul" in text nodes (and the page title),
// live, via a MutationObserver. It only touches text — never attributes/hrefs — so links
// (e.g. the AGPL source link) and lowercase URLs like joinpeertube.org are left intact.
async function register () {
  const RE = /PeerTube/g
  const TO = 'Teknakul'
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 }

  function fixText (node) {
    const v = node.nodeValue
    if (v && v.indexOf('PeerTube') !== -1) node.nodeValue = v.replace(RE, TO)
  }

  function walk (root) {
    if (!root) return
    if (root.nodeType === 3) { fixText(root); return }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return
    try {
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode (n) {
          const p = n.parentNode && n.parentNode.nodeName
          if (p && SKIP[p]) return NodeFilter.FILTER_REJECT
          return (n.nodeValue && n.nodeValue.indexOf('PeerTube') !== -1)
            ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        }
      })
      const batch = []
      let n
      while ((n = it.nextNode())) batch.push(n)
      batch.forEach(fixText)
    } catch (e) { /* ignore */ }
  }

  function fixTitle () {
    try { if (document.title.indexOf('PeerTube') !== -1) document.title = document.title.replace(RE, TO) } catch (e) {}
  }

  function boot () {
    const target = document.body || document.documentElement
    if (!target) return setTimeout(boot, 50)
    walk(target)
    fixTitle()
    try {
      const mo = new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'characterData') { fixText(m.target); continue }
          if (m.addedNodes) m.addedNodes.forEach(walk)
        }
        fixTitle()   // Angular re-sets <title> on route changes
      })
      mo.observe(target, { childList: true, subtree: true, characterData: true })
    } catch (e) { /* ignore */ }
    // Also watch <title> directly so tab titles are caught even without body changes.
    try {
      const t = document.querySelector('title')
      if (t) new MutationObserver(fixTitle).observe(t, { childList: true, characterData: true, subtree: true })
    } catch (e) { /* ignore */ }
  }
  boot()
}

export { register }
