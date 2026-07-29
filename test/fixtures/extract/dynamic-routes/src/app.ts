import express from "express";

const app = express();

// Static route (should be resolved)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Dynamic routes from config (should be unresolved)
const routes = ["/api/v1/users", "/api/v1/posts", "/api/v1/comments"];

for (const route of routes) {
  app.get(route, (req, res) => {
    res.json({ path: route });
  });
}

// Dynamic route from variable (should be unresolved)
const basePath = process.env.API_BASE || "/api";
app.get(basePath + "/status", (req, res) => {
  res.json({ status: "running" });
});

// Spread-based dynamic registration (should be unresolved)
const handlers = [...getHandlers()];
handlers.forEach(({ path, handler }) => {
  app.post(path, handler);
});

function getHandlers() {
  return [{ path: "/webhook", handler: (req: any, res: any) => res.send("ok") }];
}

export default app;
