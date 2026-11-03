#!/usr/bin/env bash
#
# Is this repo still what the instance is running?
#
# WHY THIS EXISTS. On 3 November 2026 the repo was two plugins behind
# production and nobody knew: brand was at 1.0.1 here while 1.0.3 was
# serving, and multistream the same. Plugins are edited on the host, in
# data/plugin-src, and installed from there — so the repo only stays
# current if somebody remembers to copy the change back, and a fortnight
# of remembering is not a plan.
#
# This compares the version in every plugin's package.json against the
# same file on the host and exits non-zero if any differ, so it can go in
# front of a release or simply be run after touching a plugin.
#
# It compares VERSIONS, not file contents, deliberately: a plugin edited
# without a version bump cannot be installed cleanly either, because
# PeerTube serves client scripts from a path containing the version and
# caches them immutable for thirty days. A change with no bump is already
# a bug, and this surfaces it as "same version, different content" below.
#
# Usage:
#   tools/check-drift.sh              # against the default host
#   TEKNAKUL_HOST=other tools/check-drift.sh

set -uo pipefail

HOST="${TEKNAKUL_HOST:-linuxg1}"
SRC="/home/lacy/teknakul/data/plugin-src"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

command -v ssh >/dev/null || { echo "ssh is needed to reach ${HOST}" >&2; exit 2; }

if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "${HOST}" true 2>/dev/null; then
    echo "cannot reach ${HOST} over ssh without a password" >&2
    exit 2
fi

version_of () { grep -m1 '"version"' "$1" 2>/dev/null | sed -E 's/.*"version"[^"]*"([^"]+)".*/\1/'; }

drift=0
missing=0

for dir in "${HERE}"/plugins/*/; do
    name="$(basename "${dir}")"
    here_v="$(version_of "${dir}package.json")"

    there_v="$(ssh -o BatchMode=yes "${HOST}" \
        "sudo -n grep -m1 '\"version\"' ${SRC}/${name}/package.json 2>/dev/null" \
        | sed -E 's/.*"version"[^"]*"([^"]+)".*/\1/')"

    if [ -z "${there_v}" ]; then
        printf '%-46s repo=%-8s host=ABSENT\n' "${name}" "${here_v:-?}"
        missing=$((missing + 1))
        continue
    fi

    if [ "${here_v}" != "${there_v}" ]; then
        printf '%-46s repo=%-8s host=%-8s DRIFTED\n' "${name}" "${here_v:-?}" "${there_v}"
        drift=$((drift + 1))
    fi
done

# A plugin the host has and the repo does not is the worse direction: it
# exists only on one disk, which is the state this repo was created to end.
extra="$(ssh -o BatchMode=yes "${HOST}" "sudo -n ls ${SRC}" 2>/dev/null \
    | while read -r n; do [ -d "${HERE}/plugins/${n}" ] || echo "${n}"; done)"

if [ -n "${extra}" ]; then
    echo
    echo "on the host but NOT in this repo:"
    echo "${extra}" | sed 's/^/  /'
    drift=$((drift + 1))
fi

echo
if [ "${drift}" -eq 0 ] && [ "${missing}" -eq 0 ]; then
    echo "in step with ${HOST}"
    exit 0
fi

echo "${drift} drifted, ${missing} absent on the host"
echo "to sync one:  ssh ${HOST} \"sudo -n tar -C ${SRC} -cf - <plugin>\" | tar -C plugins -xf -"
exit 1
