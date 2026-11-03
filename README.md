# Teknakul plugins

Open-source (**AGPL-3.0**) plugins for **[Teknakul](https://www.teknakul.com)** — a video
platform for technical people, built on **[PeerTube](https://joinpeertube.org)** (PeerTube 7.3.0).

These are the custom parts of the Teknakul server that run inside PeerTube: browser/phone
go-live (WebRTC/WHIP), multistream, unified chat, analytics, runbook AI links, invites,
branding, categories, featured channels, theme and more.

## Corresponding Source (AGPL-3.0)

Teknakul runs a stock PeerTube server plus the plugins in this repository. The Corresponding
Source of the running version is:

- **PeerTube** — https://github.com/Chocobozzz/PeerTube (v7.3.0), AGPL-3.0.
- **These plugins** — this repository, AGPL-3.0.

The hosted service runs at https://www.teknakul.com. Separate backend services that communicate
with the platform over its network API are independent programs and are not part of this work.

## License

AGPL-3.0 — see [LICENSE](LICENSE).

## Keeping this in step with the instance

Plugins are edited on the host in `data/plugin-src` and installed from
there, so this repo only stays current if the change is copied back. On
3 November 2026 it was two plugins behind production and nobody knew.

```bash
tools/check-drift.sh
```

It compares every plugin's version against the host, exits non-zero if any
differ, and names anything on the host that is missing here — which is the
worse direction, since that plugin then exists on one disk only.

It compares **versions**, not file contents, on purpose: a plugin edited
without a version bump cannot be installed cleanly anyway, because PeerTube
serves client scripts from a path containing the version and caches them
`immutable` for thirty days.
