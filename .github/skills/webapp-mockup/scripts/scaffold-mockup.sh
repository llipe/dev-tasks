#!/usr/bin/env bash
set -euo pipefail

# Scaffolds a consistent React + shadcn-style mockup app at:
# /mockups/mockup-<feature>-<num>

usage() {
  cat <<'USAGE'
Usage:
  ./.github/skills/webapp-mockup/scripts/scaffold-mockup.sh <feature> <num> [palette_url]

Examples:
  ./.github/skills/webapp-mockup/scripts/scaffold-mockup.sh onboarding 1
  ./.github/skills/webapp-mockup/scripts/scaffold-mockup.sh billing 2 https://colorhunt.co/palette/281c594e8d9c85c79aedf7bd
USAGE
}

if [[ $# -lt 2 || $# -gt 3 ]]; then
  usage
  exit 1
fi

FEATURE_RAW="$1"
NUM_RAW="$2"
PALETTE_URL="${3:-https://colorhunt.co/palette/281c594e8d9c85c79aedf7bd}"

if ! [[ "$NUM_RAW" =~ ^[0-9]+$ ]]; then
  echo "Error: <num> must be an integer."
  exit 1
fi

FEATURE="$(echo "$FEATURE_RAW" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')"
if [[ -z "$FEATURE" ]]; then
  echo "Error: <feature> produced an empty slug."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
MOCKUPS_ROOT="$REPO_ROOT/mockups"
APP_DIR="$MOCKUPS_ROOT/mockup-${FEATURE}-${NUM_RAW}"

if [[ -d "$APP_DIR" ]]; then
  echo "Error: target already exists: $APP_DIR"
  exit 1
fi

mkdir -p "$MOCKUPS_ROOT"

echo "Creating app at: $APP_DIR"
npm create vite@latest "$APP_DIR" -- --template react-ts

pushd "$APP_DIR" >/dev/null

npm install
npm install class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-dialog
npm install -D tailwindcss postcss autoprefixer tailwindcss-animate
npx tailwindcss init -p

cat > tailwind.config.js <<'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        cardForeground: "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        primaryForeground: "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        secondaryForeground: "hsl(var(--secondary-foreground))",
        accent: "hsl(var(--accent))",
        accentForeground: "hsl(var(--accent-foreground))",
        warning: "hsl(var(--warning))",
        warningForeground: "hsl(var(--warning-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 220ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
EOF

mkdir -p src/components/ui src/lib

cat > src/lib/utils.ts <<'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

cat > src/components/ui/button.tsx <<'EOF'
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primaryForeground hover:opacity-90",
        outline: "border border-border bg-background hover:bg-secondary hover:text-secondaryForeground",
        ghost: "hover:bg-secondary hover:text-secondaryForeground",
        warning: "bg-warning text-warningForeground hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
EOF

cat > src/components/ui/input.tsx <<'EOF'
import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  )
})
Input.displayName = "Input"
EOF

cat > src/components/ui/dialog.tsx <<'EOF'
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg",
          className
        )}
        {...props}
      >
        {props.children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-80 transition-opacity hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
EOF

cat > src/components/ui/alert.tsx <<'EOF'
import * as React from "react"
import { cn } from "../../lib/utils"

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-warning bg-warning/15 p-3 text-sm", className)} {...props} />
}
EOF

cat > src/index.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Default palette source:
   https://colorhunt.co/palette/281c594e8d9c85c79aedf7bd
*/
:root {
  --radius: 0.6rem;

  --background: 46 73% 95%;      /* #EDF7BD */
  --foreground: 258 53% 23%;     /* #281C59 */

  --card: 0 0% 100%;
  --card-foreground: 258 53% 23%;

  --primary: 258 53% 23%;        /* #281C59 */
  --primary-foreground: 0 0% 100%;

  --secondary: 191 34% 46%;      /* #4E8D9C */
  --secondary-foreground: 0 0% 100%;

  --accent: 96 40% 64%;          /* #85C79A */
  --accent-foreground: 258 53% 20%;

  --warning: 12 88% 59%;
  --warning-foreground: 0 0% 100%;

  --border: 191 20% 78%;
  --input: 191 20% 78%;
  --ring: 191 34% 46%;
}

* {
  @apply border-border;
}

body {
  @apply min-h-screen bg-background text-foreground antialiased;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}
EOF

cat > src/mockup.css <<'EOF'
.mockup-enter {
  animation: fadeUp 220ms ease-out;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
EOF

cat > src/App.tsx <<'EOF'
import { useMemo, useState } from "react"
import "./mockup.css"
import { Alert } from "./components/ui/alert"
import { Button } from "./components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "./components/ui/dialog"
import { Input } from "./components/ui/input"

type FormState = {
  fullName: string
  email: string
  company: string
  accepted: boolean
}

type FormErrors = Partial<Record<keyof FormState, string>>

function validateForm(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required."
  }

  if (!values.email.trim()) {
    errors.email = "Email is required."
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Use a valid email format."
  }

  if (!values.company.trim()) {
    errors.company = "Company is required."
  }

  if (!values.accepted) {
    errors.accepted = "You must accept terms to continue."
  }

  return errors
}

export default function App() {
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    company: "",
    accepted: false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors])

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    setSubmitted(Object.keys(nextErrors).length === 0)
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <header className="mockup-enter mb-8 rounded-xl border bg-card p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Mockup Banner</p>
        <h1 className="text-2xl font-semibold">Mockup Workspace</h1>
        <p className="mt-2 text-sm text-foreground/80">
          This is a partial mockup section. Extend this area with additional flows and link each new section from here.
        </p>
        <p className="mt-1 text-xs text-foreground/70">
          Palette source: PLACEHOLDER_PALETTE_URL
        </p>
      </header>

      <section className="mockup-enter grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={onSubmit} className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Lead Capture Section</h2>
          <p className="mt-1 text-sm text-foreground/80">
            Includes inputs, validations, warning states, confirmation popup, and transition-ready UI blocks.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium">Full name</label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                aria-invalid={Boolean(errors.fullName)}
              />
              {errors.fullName && <p className="mt-1 text-xs text-warning">{errors.fullName}</p>}
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Work email</label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="mt-1 text-xs text-warning">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="company" className="mb-1 block text-sm font-medium">Company</label>
              <Input
                id="company"
                value={form.company}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
                aria-invalid={Boolean(errors.company)}
              />
              {errors.company && <p className="mt-1 text-xs text-warning">{errors.company}</p>}
            </div>

            <label className="flex items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                checked={form.accepted}
                onChange={(event) => setForm((prev) => ({ ...prev, accepted: event.target.checked }))}
                className="mt-1"
              />
              <span className="text-sm">I accept terms and understand this is a mockup-only workflow.</span>
            </label>
            {errors.accepted && <p className="mt-1 text-xs text-warning">{errors.accepted}</p>}

            <div className="flex flex-wrap gap-3">
              <Button type="submit">Validate inputs</Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">Open confirmation popup</Button>
                </DialogTrigger>
                <DialogContent>
                  <h3 className="text-lg font-semibold">Mockup Confirmation</h3>
                  <p className="mt-2 text-sm text-foreground/80">
                    This popup demonstrates a future confirmation step. Connect this to a real action in implementation.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button type="button">Confirm</Button>
                    <Button type="button" variant="outline">Cancel</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </form>

        <aside className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Status + Warnings</h3>

          {hasErrors ? (
            <Alert className="mt-4">
              Some fields need attention before progressing. This warning block should remain visible on invalid submit.
            </Alert>
          ) : (
            <div className="mt-4 rounded-md border border-accent bg-accent/20 p-3 text-sm">
              No current validation warnings.
            </div>
          )}

          {submitted && (
            <div className="mockup-enter mt-4 rounded-md border border-secondary bg-secondary/15 p-3 text-sm">
              Validation passed. Next flow step intentionally not implemented in this partial mockup.
            </div>
          )}

          <div className="mt-4 rounded-md border p-3 text-sm">
            <p className="font-medium">Transition Notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/80">
              <li>Use entrance animations for newly revealed sections.</li>
              <li>Animate warning visibility when validation state changes.</li>
              <li>Use popup transitions for confirmations and destructive actions.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  )
}
EOF

# Set palette reference in App banner line.
sed -i '' "s|PLACEHOLDER_PALETTE_URL|$PALETTE_URL|g" src/App.tsx

# Remove default starter styles if present.
rm -f src/App.css

echo
echo "Done. Mockup app created at: $APP_DIR"
echo "Run it with:"
echo "  cd $APP_DIR"
echo "  npm run dev"

popd >/dev/null
