import fastify from "fastify";
import { z } from "zod";

const app = fastify();

const CreateProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  category: z.enum(["electronics", "clothing", "food"]),
  description: z.string().optional(),
});

// GET /products - list products
app.get("/products", async (req, reply) => {
  return [{ id: 1, name: "Widget", price: 9.99 }];
});

// GET /products/:id - get product
app.get("/products/:id", async (req, reply) => {
  return { id: 1, name: "Widget", price: 9.99 };
});

// POST /products - create product (with zod validation)
app.post("/products", async (req, reply) => {
  const body = CreateProductSchema.parse(req.body);
  return { id: 2, ...body };
});

// PUT /products/:id - update product
app.put("/products/:id", async (req, reply) => {
  return { id: 1, name: "Updated Widget", price: 19.99 };
});

export default app;
