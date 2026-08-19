#!/usr/bin/env bash
set -euo pipefail

# scaffold-full.sh — Generate a react-full mockup via shadcn CLI.
# Creates a Vite + React + Tailwind v4 + shadcn/ui project, then
# replaces the default theme with ux-theme-gen output.
#
# Usage:
#   ./scripts/scaffold-full.sh <feature> <variant-num> <output-dir> [theme-css-path]
#
# Example:
#   ./scripts/scaffold-full.sh billing 1 /mockups/mockup-billing-1 /mockups/.theme/theme.css
#
# Prerequisites:
#   - Node.js >= 24
#   - pnpm available (preferred) or npm
#   - Internet access for npm create vite + shadcn init

SHADCN_VERSION="4.18.0"

usage() {
  echo "Usage: $0 <feature> <variant-num> <output-dir> [theme-css-path]"
  echo ""
  echo "  feature         Feature slug (lowercase, hyphenated)"
  echo "  variant-num     Variant number (integer)"
  echo "  output-dir      Directory to create the project in (must not exist)"
  echo "  theme-css-path  Path to theme.css from ux-theme-gen (optional; merged after scaffold)"
  exit 1
}

if [[ $# -lt 3 || $# -gt 4 ]]; then
  usage
fi

FEATURE="$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')"
VARIANT="$2"
OUTPUT_DIR="$3"
THEME_CSS="${4:-}"

if [[ -z "$FEATURE" ]]; then
  echo "Error: <feature> produced an empty slug."
  exit 1
fi

if ! [[ "$VARIANT" =~ ^[0-9]+$ ]]; then
  echo "Error: <variant-num> must be an integer."
  exit 1
fi

if [[ -d "$OUTPUT_DIR" ]]; then
  echo "Error: output directory already exists: $OUTPUT_DIR"
  exit 1
fi

# Detect package manager
PM="npm"
if command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"
fi

echo "[scaffold-full] Creating Vite + React project at: $OUTPUT_DIR"
echo "[scaffold-full] Package manager: $PM"
echo "[scaffold-full] shadcn version: ${SHADCN_VERSION}"

# Step 1: Create Vite project
CI=1 npm_config_yes=true npm create vite@latest "$OUTPUT_DIR" -- --template react-ts

# Step 2: Install dependencies with pnpm (or npm)
pushd "$OUTPUT_DIR" >/dev/null

if [[ "$PM" == "pnpm" ]]; then
  pnpm install
else
  npm install
fi

# Step 3: Install Tailwind v4 + Vite plugin (replaces postcss/autoprefixer pattern)
$PM add tailwindcss@^4 @tailwindcss/vite@^4 tw-animate-css@^1.4

# Step 4: Configure vite.config.ts with tailwindcss plugin and path alias
cat > vite.config.ts << 'VITE_EOF'
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
VITE_EOF

# Step 5: Create minimal index.css for shadcn init to find
cat > src/index.css << 'CSS_EOF'
@import "tailwindcss";
CSS_EOF

# Step 6: Run shadcn init (writes components.json, updates deps, creates utils)
npx --yes "shadcn@${SHADCN_VERSION}" init \
  --base radix \
  --preset nova \
  --css-variables \
  --yes \
  --silent

echo "[scaffold-full] shadcn init complete."

# Step 7: Merge theme.css if provided
if [[ -n "$THEME_CSS" && -f "$THEME_CSS" ]]; then
  echo "[scaffold-full] Merging theme from: $THEME_CSS"
  # The shadcn init writes its own :root block into src/index.css.
  # We replace the :root and @theme inline sections with the DESIGN.md-derived ones.
  # Strategy: append our theme.css content after the @import lines.
  # The agent should refine this merge based on actual content.

  # Extract @import lines from current index.css
  IMPORTS=$(grep -E "^@import" src/index.css || true)

  # Rebuild index.css: imports + our theme + base layer
  {
    echo "$IMPORTS"
    echo ""
    cat "$THEME_CSS"
    echo ""
    echo "@layer base {"
    echo "  * {"
    echo "    @apply border-border outline-ring/50;"
    echo "  }"
    echo "  body {"
    echo "    @apply bg-background text-foreground;"
    echo "  }"
    echo "}"
  } > src/index.css

  echo "[scaffold-full] Theme merged into src/index.css"
fi

# Step 8: Create a placeholder App.tsx
cat > src/App.tsx << 'APP_EOF'
import "./index.css"

export default function App() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
          Mockup — Variant VARIANT_NUM
        </p>
        <h1 className="text-2xl font-semibold">FEATURE_NAME</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a full-fidelity mockup scaffold. Implement screens and interactions here.
        </p>
      </header>

      {/* Agent: implement mockup screens below */}
      <section className="rounded-xl border bg-card p-5 shadow-sm" data-ac="AC-TODO">
        <h2 className="text-lg font-semibold">Screen Content</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Replace this with the actual mockup implementation.
        </p>
      </section>
    </main>
  )
}
APP_EOF

# Replace placeholders
sed -i '' "s/VARIANT_NUM/${VARIANT}/g" src/App.tsx
sed -i '' "s/FEATURE_NAME/${FEATURE}/g" src/App.tsx

# Clean up Vite default files
rm -f src/App.css src/assets/react.svg public/vite.svg

popd >/dev/null

echo ""
echo "[scaffold-full] Done. Project created at: $OUTPUT_DIR"
echo "  cd $OUTPUT_DIR"
echo "  $PM run dev"
