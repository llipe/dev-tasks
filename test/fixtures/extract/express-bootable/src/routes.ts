/**
 * Route configuration — routes are registered dynamically from this array.
 * AST inference (route3) cannot resolve these because the path is read from
 * a runtime data structure, not a string literal in a .get()/.post() call.
 */

export interface RouteConfig {
  method: "get" | "post" | "put" | "delete";
  path: string;
  handler: string;
}

export const dynamicRoutes: RouteConfig[] = [
  { method: "get", path: "/health", handler: "healthCheck" },
  { method: "get", path: "/metrics", handler: "getMetrics" },
  { method: "post", path: "/webhooks/stripe", handler: "handleStripeWebhook" },
  { method: "post", path: "/webhooks/github", handler: "handleGithubWebhook" },
];
