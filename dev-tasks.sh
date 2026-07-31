#!/usr/bin/env bash
# dev-tasks.sh is deprecated.
# The project has moved to an npm package.
#
# Install: pnpm add -g @llipe.com/dev-tasks
# Docs:    https://www.npmjs.com/package/@llipe.com/dev-tasks
#
# This script exists only to inform users who still have it checked out.

set -euo pipefail

printf "\n"
printf "  ╔══════════════════════════════════════════════════════════════╗\n"
printf "  ║  dev-tasks.sh has been replaced by the npm package:        ║\n"
printf "  ║                                                            ║\n"
printf "  ║    https://www.npmjs.com/package/@llipe.com/dev-tasks      ║\n"
printf "  ║                                                            ║\n"
printf "  ║  Install with:                                             ║\n"
printf "  ║    pnpm add -g @llipe.com/dev-tasks                        ║\n"
printf "  ║                                                            ║\n"
printf "  ║  Then use:                                                 ║\n"
printf "  ║    dev-tasks install   — install agent files into a repo   ║\n"
printf "  ║    dev-tasks update    — update with conflict detection    ║\n"
printf "  ║    dev-tasks status    — check installed vs latest         ║\n"
printf "  ║    dt extract all      — extract repo metadata             ║\n"
printf "  ╚══════════════════════════════════════════════════════════════╝\n"
printf "\n"

exit 0
