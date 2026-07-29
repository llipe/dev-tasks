import express, { Request, Response } from "express";

const app = express();

interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserBody {
  name: string;
  email: string;
}

// GET /users - list users
app.get("/users", (req: Request, res: Response<User[]>): User[] => {
  return [{ id: 1, name: "Alice", email: "alice@example.com" }];
});

// GET /users/:id - get user by id
app.get("/users/:id", (req: Request<{ id: string }>, res: Response<User>): User => {
  return { id: 1, name: "Alice", email: "alice@example.com" };
});

// POST /users - create user
app.post("/users", (req: Request<unknown, unknown, CreateUserBody>, res: Response<User>): User => {
  return { id: 2, name: req.body.name, email: req.body.email };
});

// DELETE /users/:id - delete user
app.delete("/users/:id", (req: Request<{ id: string }>, res: Response): void => {
  res.status(204).send();
});

export default app;
