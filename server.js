/**
 * Workora server: Next.js + WebSocket (path /ws) in ONE process.
 *
 *   npm run dev     → development (hot reload)
 *   npm run build   → production build
 *   npm start       → production server (run `npm run build` first)
 *
 * Env: PORT (3000), HOST (localhost; use 0.0.0.0 to open it to your LAN),
 *      WS_ALLOWED_ORIGINS (optional, comma separated, when running behind a proxy).
 *
 * The REST routes publish events through globalThis[Symbol.for("workora.realtime")]
 * (see lib/realtime.js); only users that are targeted by an event receive it.
 */
const dev = !process.argv.includes("--prod") && process.env.NODE_ENV !== "production";
process.env.NODE_ENV = dev ? "development" : "production";

const { createServer } = require("http");
const next = require("next");
const { WebSocketServer } = require("ws");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), dev);

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || "localhost";
const COOKIE_NAME = "workora_session";
const MAX_CONNECTIONS_PER_USER = 10;

/* ------------------------------------------------------------------ hub */
const clients = new Map(); // userId -> Set<WebSocket>

function publish(userIds, event) {
  const data = JSON.stringify(event);
  for (const id of userIds) {
    const set = clients.get(String(id));
    if (!set) continue;
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(data);
    }
  }
}

globalThis[Symbol.for("workora.realtime")] = { publish };

/* ------------------------------------------------------------------ auth */
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

let joseModule = null;
async function userIdFromToken(token) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is missing");
  joseModule = joseModule || (await import("jose"));
  const { payload } = await joseModule.jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
  return payload.userId ? String(payload.userId) : null;
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const extra = (process.env.WS_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function reject(socket, code, text) {
  try {
    socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
  } finally {
    socket.destroy();
  }
}

/* ------------------------------------------------------------------ boot */
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const nextUpgrade = typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;
  const server = createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on("upgrade", async (req, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {
      return socket.destroy();
    }

    if (pathname !== "/ws") {
      // Next.js' own sockets (hot reload in development)
      if (nextUpgrade) return nextUpgrade(req, socket, head);
      return socket.destroy();
    }

    if (!originAllowed(req)) return reject(socket, 403, "Forbidden");
    const token = readCookie(req.headers.cookie, COOKIE_NAME);
    if (!token) return reject(socket, 401, "Unauthorized");

    let userId = null;
    try {
      userId = await userIdFromToken(token);
    } catch {
      return reject(socket, 401, "Unauthorized");
    }
    if (!userId) return reject(socket, 401, "Unauthorized");

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, userId));
  });

  wss.on("connection", (ws, _req, userId) => {
    let set = clients.get(userId);
    if (!set) {
      set = new Set();
      clients.set(userId, set);
    }
    if (set.size >= MAX_CONNECTIONS_PER_USER) {
      ws.close(1008, "too many connections");
      return;
    }
    set.add(ws);
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("message", (raw) => {
      // clients only send keep-alive pings; everything else goes through the REST API
      try {
        const msg = JSON.parse(raw.toString());
        if (msg && msg.type === "ping") ws.send('{"type":"pong"}');
      } catch {
        /* ignore malformed frames */
      }
    });
    ws.on("close", () => {
      const current = clients.get(userId);
      if (!current) return;
      current.delete(ws);
      if (current.size === 0) clients.delete(userId);
    });
    ws.on("error", () => {});

    ws.send('{"type":"hello"}');
  });

  // drop dead connections (laptop closed, network lost, ...)
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* socket already closing */
      }
    }
  }, 30000);

  server.listen(port, hostname, () => {
    console.log(`> Workora ready on http://${hostname}:${port} (${dev ? "development" : "production"}) · WebSocket: /ws`);
    if (dev && !nextUpgrade) console.log("> Note: hot reload socket is unavailable with this Next.js version (page refresh still works).");
  });

  function shutdown() {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.close(1001, "server restarting");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
