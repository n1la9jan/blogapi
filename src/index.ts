import { Elysia } from "elysia";
import { env } from "./config";
import cors from "@elysiajs/cors";
import { betterAuthPlugin } from "./plugins/betterAuth";
import { blogRoutes } from "./routes/blog";
import { imageRoutes } from "./routes/images";
import { reactionRoutes } from "./routes/reactions";
import { userRoutes } from "./routes/users";
import { commentRoutes } from "./routes/comments";

const PORT = Number(process.env.PORT ?? 3000)
const app = new Elysia()
  .use(
    cors({
      origin: [
        env.domainURL!,
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(betterAuthPlugin)
  .get("/", () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(blogRoutes)
  .use(imageRoutes)
  .use(reactionRoutes)
  .use(userRoutes)
  .use(commentRoutes)
  .listen(PORT)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
