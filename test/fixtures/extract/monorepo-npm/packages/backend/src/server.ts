import Fastify from "fastify";

const app = Fastify();
app.get("/health", async () => ({ status: "ok" }));

export default app;
