import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { Readable } from "stream";
import { env } from "./env";
import { pool, shutdownDb } from "./db";

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

server.get("/health", async () => ({ ok: true }));

const askSchema = z.object({
  email: z.string().email(),
  prompt: z.string().trim().min(1).max(2000)
});

class ExternalServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalServiceError";
  }
}

server.post("/api/ask", async (req, reply) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
  }

  const { email, prompt } = parsed.data;

  try {
    const userId = await upsertUser(email);
    const answer = await askAi(userId, prompt);
    return { answer };
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      return reply.status(502).send({ error: "AI service unavailable" });
    }
    server.log.error(error);
    return reply.status(500).send({ error: "Unexpected error" });
  }
});

server.post("/api/ask/stream", async (req, reply) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
  }

  const { email, prompt } = parsed.data;

  try {
    const userId = await upsertUser(email);
    const response = await fetch(`${env.AI_SERVICE_URL}/infer/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, prompt })
    });

    if (!response.ok || !response.body) {
      throw new ExternalServiceError("AI service responded with error");
    }

    reply.header("Content-Type", "text/plain; charset=utf-8");
    reply.header("Cache-Control", "no-cache");
    reply.header("Transfer-Encoding", "chunked");
    const nodeStream = Readable.fromWeb(response.body as any);
    return reply.send(nodeStream);
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      return reply.status(502).send({ error: "AI service unavailable" });
    }
    server.log.error(error);
    return reply.status(500).send({ error: "Unexpected error" });
  }
});

async function upsertUser(email: string): Promise<string> {
  const result = await pool.query(
    `
      INSERT INTO users (email)
      VALUES ($1)
      ON CONFLICT (email) DO UPDATE
        SET email = EXCLUDED.email
      RETURNING id
    `,
    [email]
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error("Failed to create or find user");
  }
  return id;
}

async function askAi(userId: string, prompt: string): Promise<string> {
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/infer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, prompt })
    });

    if (!response.ok) {
      throw new ExternalServiceError("AI service responded with error");
    }

    const body = (await response.json()) as { answer?: string };
    return body.answer ?? "";
  } catch (error) {
    throw new ExternalServiceError("AI service unavailable");
  }
}

async function gracefulShutdown(): Promise<void> {
  try {
    await server.close();
  } finally {
    await shutdownDb();
  }
}

process.on("SIGINT", async () => {
  await gracefulShutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await gracefulShutdown();
  process.exit(0);
});

try {
  await server.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
