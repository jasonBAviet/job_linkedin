import "server-only";
import net from "node:net";
import { Client as SshClient } from "ssh2";

/**
 * SSH tunnel in-process cho Next.js.
 *
 * KHÔNG đưa stream forwardOut thẳng vào `pg`: pg gọi stream.setNoDelay() và
 * stream.connect() mà ssh2.Channel không có. Thay vào đó dựng một net.Server
 * cục bộ trên cổng ephemeral và pipe từng socket vào một channel riêng.
 */

export interface TunnelState {
  server: net.Server;
  ssh: SshClient;
  localPort: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __jhTunnel: Promise<TunnelState> | undefined;
  // eslint-disable-next-line no-var
  var __jhTunnelHooks: boolean | undefined;
}

const lossHandlers = new Set<() => void>();

/** pool đăng ký ở đây để tránh import vòng tunnel <-> client. */
export function onTunnelLost(fn: () => void): void {
  lossHandlers.add(fn);
}

function env(key: string, fallback?: string): string {
  const v = (process.env[key] || "").trim();
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`[db] Thiếu biến môi trường ${key} trong .env`);
}

async function createTunnel(): Promise<TunnelState> {
  const ssh = new SshClient();
  const sshPassword = env("SSH_PASSWORD");

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      ssh.removeListener("error", onErr);
      resolve();
    };
    const onErr = (e: Error) => {
      ssh.removeListener("ready", onReady);
      reject(e);
    };
    ssh.once("ready", onReady);
    ssh.once("error", onErr);

    // Nhiều sshd chỉ quảng bá keyboard-interactive; thiếu handler này thì auth
    // thất bại dù mật khẩu đúng.
    ssh.on("keyboard-interactive", (_n, _i, _l, prompts, finish) =>
      finish(prompts.map(() => sshPassword))
    );

    ssh.connect({
      host: env("SSH_HOST"),
      port: Number(env("SSH_PORT", "22")),
      username: env("SSH_USER"),
      password: sshPassword,
      tryKeyboard: true,
      readyTimeout: 20_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 4,
    });
  });

  // Địa chỉ Postgres NHÌN TỪ PHÍA SERVER — không dùng DB_HOST (IP public).
  const dbHost = env("DB_TUNNEL_REMOTE_HOST", "127.0.0.1");
  const dbPort = Number(env("DB_PORT", "5432"));

  const server = net.createServer((sock) => {
    sock.setNoDelay(true);
    sock.on("error", () => sock.destroy());
    // forwardOut throw ĐỒNG BỘ ('Not connected') khi SSH đã chết
    try {
      ssh.forwardOut("127.0.0.1", sock.remotePort ?? 0, dbHost, dbPort, (err, stream) => {
        if (err) {
          sock.destroy();
          return;
        }
        stream.on("error", () => sock.destroy());
        stream.on("close", () => sock.destroy());
        // pg gọi destroy() không graceful -> tự đóng channel, tránh rò session sshd
        sock.on("close", () => {
          try {
            stream.destroy();
          } catch {}
        });
        sock.pipe(stream);
        stream.pipe(sock);
      });
    } catch {
      sock.destroy();
    }
  });

  const localPort = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    // port 0 -> HĐH cấp cổng trống, không bao giờ EADDRINUSE khi hot reload
    server.listen(0, "127.0.0.1", () => resolve((server.address() as net.AddressInfo).port));
  });

  let torn = false;
  const tearDown = () => {
    if (torn) return;
    torn = true;
    console.warn("[db] SSH tunnel mất kết nối — huỷ tunnel và pool");
    try {
      server.close();
    } catch {}
    try {
      ssh.end();
    } catch {}
    globalThis.__jhTunnel = undefined;
    lossHandlers.forEach((f) => {
      try {
        f();
      } catch {}
    });
  };

  // Listener 'error' dài hạn: thiếu nó, EventEmitter ném uncaughtException
  ssh.on("error", (e) => {
    console.error("[db] SSH lỗi:", e.message);
    tearDown();
  });
  ssh.on("close", tearDown);
  ssh.on("end", tearDown);
  server.on("error", tearDown);

  console.log(`[db] SSH tunnel sẵn sàng: 127.0.0.1:${localPort} -> ${dbHost}:${dbPort}`);
  return { server, ssh, localPort };
}

/**
 * Lưu PROMISE (không phải giá trị đã resolve) vào globalThis:
 * - sống sót qua hot reload của Next dev (process không restart)
 * - hai request cold start cùng lúc sẽ cùng await một Promise thay vì mở hai tunnel
 */
export function getTunnel(): Promise<TunnelState> {
  if (!globalThis.__jhTunnel) {
    globalThis.__jhTunnel = createTunnel().catch((e) => {
      globalThis.__jhTunnel = undefined; // cho phép request sau thử lại
      throw e;
    });
  }
  if (!globalThis.__jhTunnelHooks) {
    globalThis.__jhTunnelHooks = true;
    const bye = () => void closeTunnel();
    process.once("SIGINT", bye);
    process.once("SIGTERM", bye);
  }
  return globalThis.__jhTunnel;
}

export async function closeTunnel(): Promise<void> {
  const p = globalThis.__jhTunnel;
  globalThis.__jhTunnel = undefined;
  if (!p) return;
  try {
    const t = await p;
    t.server.close();
    t.ssh.end();
  } catch {}
}
