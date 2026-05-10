#!/usr/bin/env bash
# Quick stats on dogfood capture progress.
# Usage: scripts/dogfood-stats.sh
#
# Prints the count of v0.2-tagged notes, broken down by category.
# When total ≥ 20, you're ready to copy docs/v0.2-synthesis-template.md.

set -e

REPO="${MNEMONIC_REPO:-/Users/jaywest/Documents/Claude/Projects/Mnemonic/mnemonic-kb}"
MNCLI="node $REPO/apps/cli/bin/mnemonic.js"

count_search() {
  $MNCLI search "$1" --limit 200 2>/dev/null | grep -cE "^[0-9]" || echo 0
}

V02=$(count_search "v0.2")
BUGS=$(count_search "Bug")
FRICTION=$(count_search "Friction")
FEATURES=$(count_search "Feature request")
LESSONS=$(count_search "lesson")
OPEN_PROPS=$($MNCLI proposals --status open 2>/dev/null | grep -cE "^open" || echo 0)

cat <<EOF
─── Mnemonic dogfood stats ───────────────────────
Vault:                $MNEMONIC_VAULT
v0.2-tagged notes:    $V02
  bugs:               $BUGS
  friction:           $FRICTION
  feature requests:   $FEATURES
  lessons:            $LESSONS
open proposals:       $OPEN_PROPS
──────────────────────────────────────────────────
EOF

if [ "$V02" -ge 20 ]; then
  echo "✓ You're past 20 v0.2 notes. Ready to synthesize."
  echo "  cp docs/v0.2-synthesis-template.md docs/v0.2-design.md"
elif [ "$V02" -ge 10 ]; then
  echo "→ Halfway to synthesis threshold ($V02/20). Keep capturing."
else
  echo "→ Early. Keep capturing ($V02/20)."
fi
