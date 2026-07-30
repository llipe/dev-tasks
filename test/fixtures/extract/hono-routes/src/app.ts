import { Hono } from "hono";

const app = new Hono();

// Simple routes
app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/items", (c) => c.json([{ id: 1, name: "Item 1" }]));

app.get("/items/:id", (c) => {
  const id = c.req.param("id");
  return c.json({ id, name: "Item 1" });
});

app.post("/items", (c) => c.json({ id: 2, name: "New Item" }));

app.delete("/items/:id", (c) => c.json({ deleted: true }));

export default app;
