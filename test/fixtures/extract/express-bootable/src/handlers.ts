import type { Request, Response } from "express";

export function healthCheck(_req: Request, res: Response): void {
  res.json({ status: "ok" });
}

export function getMetrics(_req: Request, res: Response): void {
  res.json({ uptime: process.uptime(), memory: process.memoryUsage() });
}

export function handleStripeWebhook(req: Request, res: Response): void {
  res.status(200).json({ received: true });
}

export function handleGithubWebhook(req: Request, res: Response): void {
  res.status(200).json({ received: true });
}
