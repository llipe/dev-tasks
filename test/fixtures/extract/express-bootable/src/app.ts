import express, { Request, Response, Router } from "express";
import { dynamicRoutes } from "./routes.js";
import * as handlers from "./handlers.js";

const app = express();
app.use(express.json());

// --- Static routes (route3 CAN resolve these) ---

app.get("/users", (_req: Request, res: Response): void => {
  res.json([]);
});

app.get("/users/:id", (req: Request, res: Response): void => {
  res.json({ id: req.params.id });
});

app.post("/users", (req: Request, res: Response): void => {
  res.status(201).json(req.body);
});

// --- Dynamic routes registered from config array ---
// route3 (AST) CANNOT resolve these because the path comes from a runtime variable.

const handlerMap: Record<string, (req: Request, res: Response) => void> = {
  healthCheck: handlers.healthCheck,
  getMetrics: handlers.getMetrics,
  handleStripeWebhook: handlers.handleStripeWebhook,
  handleGithubWebhook: handlers.handleGithubWebhook,
};

for (const route of dynamicRoutes) {
  const handler = handlerMap[route.handler];
  if (handler) {
    app[route.method](route.path, handler);
  }
}

// --- Router mounted with a variable prefix ---
// route3 (AST) CANNOT resolve the prefix because it's computed at runtime.

const apiVersion = process.env.API_VERSION ?? "v1";
const versionedRouter = Router();

versionedRouter.get("/status", (_req: Request, res: Response): void => {
  res.json({ version: apiVersion, status: "running" });
});

versionedRouter.get("/config", (_req: Request, res: Response): void => {
  res.json({ features: [] });
});

versionedRouter.post("/config", (req: Request, res: Response): void => {
  res.status(200).json({ updated: true });
});

// Mount with a variable prefix — route3 sees `app.use(prefix, router)` but
// cannot determine the value of `prefix` statically.
const prefix = `/api/${apiVersion}`;
app.use(prefix, versionedRouter);

export default app;
