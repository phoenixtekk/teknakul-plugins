// Teknakul Brand — rebrands residual "PeerTube" UI text to "Teknakul".
// PeerTube's Angular client hardcodes some brand strings (the admin "Welcome to PeerTube"
// dialog, menu/About copy) that aren't exposed as instance settings. This client script
// replaces the visible word "PeerTube" with "Teknakul" in text nodes (and the page title),
// live, via a MutationObserver. It only touches text — never attributes/hrefs — so links
// (e.g. the AGPL source link) and lowercase URLs like joinpeertube.org are left intact.
//
// 1.0.3 — AND THE ATTRIBUTION THE WORD SWAP MUST NOT TOUCH.
//
// Swapping the word everywhere rewrote the credit to the upstream project, which is
// both nonsense and wrong. The signup page read "TEKNAKUL has been created using
// Teknakul, a video creation platform developed by Framasoft", and /about/peertube —
// the page whose entire job is to describe and credit PeerTube — announced that
// "Teknakul is a self-hosted ActivityPub-federated video streaming platform", with the
// AGPLv3 link, the docs links and the repository link underneath it all still pointing
// at PeerTube.
//
// PeerTube is AGPL-3.0. Calling this platform TEKNAKUL and saying it is built on
// PeerTube is ordinary and fine; relabelling PeerTube's own description so it appears
// to be describing Teknakul is misattribution. So two places are now left alone:
//
//   1. THE TEXT OF ANY LINK POINTING AT THE UPSTREAM PROJECT. A link that names the
//      thing it links to should name it correctly — this covers "created using
//      PeerTube", "Use PeerTube documentation", "PeerTube Applications" and
//      "Contribute on PeerTube" in one rule rather than four.
//   2. THE WHOLE /about/peertube ROUTE, where the prose is not in links and the page
//      is upstream description from top to bottom.
//
// 1.0.2 — AND THE SENTENCE THAT WORD SWAP MADE WORSE.
//
// Leaving hrefs alone is right for the source link and wrong for one sentence, which a
// tester reported reading, in full, on the login page:
//
//   "TEKNAKUL allows registration. However, be careful to check the Terms before creating
//    an account. You may also search for another Teknakul platform to match your exact
//    needs at: https://joinpeertube.org/instances."
//
// Half-rebranded and nonsense either way. The word swap turned PeerTube's invitation to go
// and pick a different instance into an invitation to find "another Teknakul platform",
// of which there are none, at a directory that has never heard of this one. Swapping the
// URL for teknakul.com would only make it circular: you are already here.
//
// So the clause goes. What is left is the part that was always true and is the reason the
// paragraph exists — registration is open, read the Terms first. The link is removed by
// MATCHING THE SENTENCE, not just the href: an anchor whose lead-in is missing is some
// other link and is left alone, because quietly deleting links is how an attribution or a
// licence notice disappears. The AGPL source link and the bug-report link are untouched.

async function register () {
  const RE = /PeerTube/g
  const TO = 'Teknakul'
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 }

  // Where the upstream project is being credited rather than merely mentioned.
  const UPSTREAM_LINK = /joinpeertube\.org|github\.com\/Chocobozzz\/PeerTube/i
  const ATTRIBUTION_ROUTES = [ '/about/peertube' ]

  function onAttributionPage () {
    try {
      return ATTRIBUTION_ROUTES.some(p => location.pathname.indexOf(p) === 0)
    } catch (e) { return false }
  }

  // Checked per node rather than once, because this is a single-page app: the
  // route changes under the same document and the observer keeps running.
  function inUpstreamLink (node) {
    let el = node && node.parentNode
    while (el && el.nodeType === 1) {
      if (el.nodeName === 'A' && UPSTREAM_LINK.test(el.getAttribute('href') || '')) return true
      el = el.parentNode
    }
    return false
  }

  // The two ways PeerTube points people at its instance directory. Both read as
  // "go and find a different one", and both are wrong on a single platform.
  // Written to match before OR after the word swap above has run.
  const LEAD_INS = [
    /\s*You may also search for another (?:PeerTube|Teknakul) platform to match your exact needs at:\s*$/i,
    /\s*Find yours among multiple platforms at:\s*$/i
  ]

  const DIRECTORY = /joinpeertube\.org\/instances|instances\.joinpeertube\.org/i

  function fixText (node) {
    if (onAttributionPage() || inUpstreamLink(node)) return

    const v = node.nodeValue
    if (v && v.indexOf('PeerTube') !== -1) node.nodeValue = v.replace(RE, TO)
  }

  /**
   * Drop "…search for another platform at: <link>." where it appears.
   *
   * Only ever when the text immediately before the anchor is one of the lead-ins,
   * so this cannot reach a link that merely happens to point at the same host.
   */
  function dropDirectorySentence (root) {
    if (!root || root.nodeType !== 1) return

    // On the page that exists to describe the upstream network, pointing at
    // that network is the point rather than a leftover.
    if (onAttributionPage()) return

    let anchors
    try {
      anchors = root.querySelectorAll ? [ ...root.querySelectorAll('a[href]') ] : []
      if (root.matches && root.matches('a[href]')) anchors.push(root)
    } catch (e) { return }

    for (const a of anchors) {
      if (!DIRECTORY.test(a.getAttribute('href') || '')) continue

      const before = a.previousSibling
      if (!before || before.nodeType !== 3) continue

      const matched = LEAD_INS.find(re => re.test(before.nodeValue || ''))
      if (!matched) continue

      // Trim the lead-in, hide the link, and tidy the full stop it left behind.
      //
      // HIDDEN RATHER THAN REMOVED. Angular owns this node and still holds a
      // reference to it; taking it out of the tree invites an error the next
      // time the framework tries to update or remove it itself. display:none
      // takes it out of the page and out of the accessibility tree, which is
      // the whole of what is wanted, and leaves Angular's world intact.
      before.nodeValue = before.nodeValue.replace(matched, '')

      a.style.display = 'none'
      a.setAttribute('aria-hidden', 'true')
      a.setAttribute('tabindex', '-1')

      const after = a.nextSibling
      if (after && after.nodeType === 3) {
        after.nodeValue = after.nodeValue.replace(/^\s*\.\s*/, ' ')
      }
    }
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

    // After the word swap, so the lead-in is matched in whichever form it is in.
    dropDirectorySentence(root)
  }

  function fixTitle () {
    if (onAttributionPage()) return   // "About PeerTube" is the right title there

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
          if (m.type === 'characterData') {
            fixText(m.target)
            // The lead-in can arrive AFTER the anchor it belongs to, so the
            // sentence has to be re-checked when its text changes, not only
            // when nodes are added.
            dropDirectorySentence(m.target.parentNode)
            continue
          }
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
