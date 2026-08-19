#!/usr/bin/env bash
set -euo pipefail

# scaffold-lite.sh — Generate a navigable html-lite mockup scaffold.
# All screens are self-contained HTML files styled from DESIGN.md tokens.
#
# Usage:
#   ./scripts/scaffold-lite.sh <feature> <variant-num> <theme-css-path> <output-dir>
#
# Example:
#   ./scripts/scaffold-lite.sh onboarding 1 /mockups/.theme/theme.css docs/requirements/mockups/onboarding/

usage() {
  echo "Usage: $0 <feature> <variant-num> <theme-css-path> <output-dir>"
  echo ""
  echo "  feature         Feature slug (lowercase, hyphenated)"
  echo "  variant-num     Variant number (integer)"
  echo "  theme-css-path  Path to the generated theme.css from ux-theme-gen"
  echo "  output-dir      Directory to create the mockup in"
  exit 1
}

if [[ $# -ne 4 ]]; then
  usage
fi

FEATURE="$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')"
VARIANT="$2"
THEME_CSS="$3"
OUTPUT_DIR="$4"

if [[ -z "$FEATURE" ]]; then
  echo "Error: <feature> produced an empty slug."
  exit 1
fi

if ! [[ "$VARIANT" =~ ^[0-9]+$ ]]; then
  echo "Error: <variant-num> must be an integer."
  exit 1
fi

if [[ ! -f "$THEME_CSS" ]]; then
  echo "Error: theme.css not found at: $THEME_CSS"
  echo "Run ux-theme-gen first to generate theme artifacts from DESIGN.md."
  exit 1
fi

# Extract :root block from theme.css to inline in HTML files
ROOT_STYLES=$(sed -n '/:root/,/^}/p' "$THEME_CSS")
THEME_INLINE=$(sed -n '/@theme inline/,/^}/p' "$THEME_CSS")

mkdir -p "$OUTPUT_DIR"

# Screen types the agent will fill with content
SCREENS=(
  "happy:Primary flow — success state"
  "error-validation:Form validation failures"
  "error-server:Server or network error state"
  "error-permission:Permission denied or unauthorized"
  "empty:No data or first-use experience"
  "loading:Skeleton screens and spinners"
  "edge-overflow:Long text, many items"
  "edge-zero:Zero items, disabled states"
)

# Generate individual screen files
for entry in "${SCREENS[@]}"; do
  name="${entry%%:*}"
  desc="${entry#*:}"
  filename="screen-${name}.html"

  cat > "${OUTPUT_DIR}/${filename}" << SCREEN_EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${FEATURE} v${VARIANT} — ${name}</title>
  <style>
${ROOT_STYLES}

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      padding: 1rem;
    }
    .nav-strip {
      display: flex; gap: 0.5rem; padding: 0.75rem 1rem;
      background: var(--muted); border-radius: 0.5rem;
      margin-bottom: 1.5rem; flex-wrap: wrap; font-size: 0.875rem;
    }
    .nav-strip a { color: var(--primary); text-decoration: none; }
    .nav-strip a:hover { text-decoration: underline; }
    .nav-strip .current { font-weight: 700; color: var(--foreground); }
    .screen-content {
      border: 1px solid var(--border); border-radius: 0.75rem;
      padding: 2rem; min-height: 60vh;
    }
    .screen-content h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    .screen-content .description { color: var(--muted-foreground); margin-bottom: 2rem; }
    .banner {
      background: var(--accent); color: var(--accent-foreground);
      padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <nav class="nav-strip">
    <a href="index.html">Index</a>
SCREEN_EOF

  # Add prev/next/related links placeholder
  cat >> "${OUTPUT_DIR}/${filename}" << 'NAV_EOF'
    <!-- Agent: replace with actual prev/next links based on screen order -->
    <span class="current">CURRENT_SCREEN</span>
  </nav>

  <div class="banner">
    Partial mockup — variant VARIANT_NUM of feature FEATURE_NAME. Extend with actual UI content.
  </div>

  <main class="screen-content" data-ac="AC-TODO">
    <h1>SCREEN_TITLE</h1>
    <p class="description">SCREEN_DESC</p>

    <!-- Agent: implement the screen content here -->
    <p style="color: var(--muted-foreground); font-style: italic;">
      Screen content to be implemented by ux-engineer.
    </p>
  </main>
</body>
</html>
NAV_EOF

  # Replace placeholders
  sed -i '' "s/CURRENT_SCREEN/${name}/g" "${OUTPUT_DIR}/${filename}"
  sed -i '' "s/VARIANT_NUM/${VARIANT}/g" "${OUTPUT_DIR}/${filename}"
  sed -i '' "s/FEATURE_NAME/${FEATURE}/g" "${OUTPUT_DIR}/${filename}"
  sed -i '' "s/SCREEN_TITLE/${name}/g" "${OUTPUT_DIR}/${filename}"
  sed -i '' "s/SCREEN_DESC/${desc}/g" "${OUTPUT_DIR}/${filename}"
done

# Generate index.html
cat > "${OUTPUT_DIR}/index.html" << INDEX_EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${FEATURE} v${VARIANT} — Screen Index</title>
  <style>
${ROOT_STYLES}

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      padding: 2rem;
      max-width: 800px; margin: 0 auto;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--muted-foreground); margin-bottom: 2rem; }
    .screen-list { list-style: none; }
    .screen-list li {
      border: 1px solid var(--border); border-radius: 0.5rem;
      padding: 1rem; margin-bottom: 0.75rem;
    }
    .screen-list a { color: var(--primary); text-decoration: none; font-weight: 600; }
    .screen-list a:hover { text-decoration: underline; }
    .screen-list .desc { color: var(--muted-foreground); font-size: 0.875rem; margin-top: 0.25rem; }
    .screen-map { margin-top: 2rem; padding: 1.5rem; border: 1px solid var(--border); border-radius: 0.75rem; }
    .screen-map h2 { margin-bottom: 1rem; }
    pre { background: var(--muted); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>${FEATURE} — Variant ${VARIANT}</h1>
  <p class="subtitle">Lite mockup — open any screen below. All links are relative and work from file://.</p>

  <ul class="screen-list">
INDEX_EOF

for entry in "${SCREENS[@]}"; do
  name="${entry%%:*}"
  desc="${entry#*:}"
  cat >> "${OUTPUT_DIR}/index.html" << ITEM_EOF
    <li>
      <a href="screen-${name}.html">${name}</a>
      <div class="desc">${desc}</div>
    </li>
ITEM_EOF
done

cat >> "${OUTPUT_DIR}/index.html" << FOOTER_EOF
  </ul>

  <div class="screen-map">
    <h2>Screen Map</h2>
    <pre><code>
See screen-map.md for the Mermaid source.
Agent: embed a rendered diagram here or link to screen-map.md.
    </code></pre>
  </div>
</body>
</html>
FOOTER_EOF

# Generate screen-map.md placeholder
cat > "${OUTPUT_DIR}/screen-map.md" << MAP_EOF
# Screen Map — ${FEATURE} v${VARIANT}

\`\`\`mermaid
flowchart LR
  happy[Happy Path] --> error-validation[Validation Error]
  happy --> empty[Empty State]
  happy --> loading[Loading]
  error-validation --> happy
  error-server[Server Error] --> happy
  error-permission[Permission Denied] --> happy
  empty --> happy
  edge-overflow[Overflow] --> happy
  edge-zero[Zero Items] --> happy
\`\`\`

> Agent: update this diagram to reflect the actual navigation flow derived from the PRD/spec.
MAP_EOF

echo "Done. Lite scaffold created at: ${OUTPUT_DIR}"
echo "  index.html + $(echo "${SCREENS[@]}" | wc -w | tr -d ' ') screen files + screen-map.md"
