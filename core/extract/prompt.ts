/**
 * Interactive prompt for non-derivable fields.
 * Detects TTY; no-op when non-interactive; unanswered → empty.
 */

import { createInterface } from "node:readline";
import type { PromptedValues } from "./component.js";

/**
 * Field prompt definition.
 */
interface FieldPrompt {
  key: keyof PromptedValues;
  label: string;
  hint: string;
}

const FIELD_PROMPTS: FieldPrompt[] = [
  { key: "owner", label: "Owner", hint: "Team or person responsible (e.g. platform-team)" },
  { key: "domain", label: "Domain", hint: "Business domain (e.g. payments, identity)" },
  {
    key: "criticality",
    label: "Criticality",
    hint: "Service criticality (critical, high, medium, low)",
  },
  {
    key: "lifecycle",
    label: "Lifecycle",
    hint: "Service lifecycle stage (production, beta, deprecated, decommissioned)",
  },
];

/**
 * Check if the current process is running in an interactive TTY.
 */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

/**
 * Prompt for non-derivable fields interactively.
 * Returns empty strings for all fields if not interactive.
 */
export async function promptNonDerivableFields(
  interactive: boolean = isInteractive(),
): Promise<PromptedValues> {
  const values: PromptedValues = {
    owner: "",
    domain: "",
    criticality: "",
    lifecycle: "",
  };

  if (!interactive) {
    return values;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });

  process.stdout.write("\nComponent fields requiring human input:\n");
  process.stdout.write("(Press Enter to skip — unanswered fields will be empty)\n\n");

  for (const prompt of FIELD_PROMPTS) {
    const answer = await ask(`  ${prompt.label} (${prompt.hint}): `);
    values[prompt.key] = answer;
  }

  rl.close();
  return values;
}

/**
 * Prompt for confirmation of an inferred field value.
 * Returns true if confirmed, false if rejected.
 * In non-interactive mode, always returns false (unconfirmed).
 */
export async function confirmInference(
  fieldName: string,
  value: string,
  interactive: boolean = isInteractive(),
): Promise<boolean> {
  if (!interactive) {
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(`  Accept inferred ${fieldName}: "${value}"? [y/N] `, (ans) => {
      resolve(ans.trim().toLowerCase());
    });
  });

  rl.close();
  return answer === "y" || answer === "yes";
}
