import net from "node:net";
import ssh2 from "ssh2";

const { Client: SshClient } = ssh2;

/**
 * Mở SSH tunnel in-process rồi cho `pg` nối vào một cổng TCP cục bộ.
 *
 * KHÔNG đưa stream forwardOut thẳng vào pg: pg gọi stream.setNoDelay() và
 * stream.connect() mà ssh2.Channel không có -> crash. Thay vào đó dựng một
 * net.Server nghe trên 127.0.0.1:0 và pipe từng socket vào một channel riêng.
 */
export async function openTunnel(env, label = "script") {
  const ssh = new SshClient();
  let dead = null;

  await new Promise((resolve, reject) => {
    const onReady = () => {
      ssh.removeListener("error", onErr);
      resolve();
    };
    const onErr = (e) => {
      ssh.removeListener("ready", onReady);
      reject(e);
    };
    ssh.once("ready", onReady);
    ssh.once("error", onErr);

    // Nhiều sshd chỉ quảng bá keyboard-interactive chứ không quảng bá password.
    // Thiếu handler này thì auth fail dù mật khẩu đúng.
    ssh.on("keyboard-interactive", (_name, _instr, _lang, prompts, finish) =>
      finish(prompts.map(() => env.sshPassword))
    );

    ssh.connect({
      host: env.sshHost,
      port: env.sshPort,
      username: env.sshUser,
      password: env.sshPassword,
      tryKeyboard: true,
      readyTimeout: 20000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 4,
    });
  });

  // Listener 'error' DÀI HẠN: thiếu nó, EventEmitter ném uncaughtException và
  // script chết đột ngột không rõ lý do khi tunnel đứt giữa chừng.
  ssh.on("error", (e) => {
    dead = e;
    console.error(`[${label}] SSH lỗi: ${e.message}`);
  });
  ssh.on("close", () => {
    dead = dead || new Error("SSH đã đóng");
  });

  const server = net.createServer((sock) => {
    sock.setNoDelay(true);
    sock.on("error", () => sock.destroy());

    // forwardOut THROW ĐỒNG BỘ ('Not connected') khi SSH đã chết -> phải try/catch.
    try {
      ssh.forwardOut("127.0.0.1", sock.remotePort ?? 0, env.remoteDbHost, env.remoteDbPort, (err, stream) => {
        if (err) {
          dead = err;
          sock.destroy();
          return;
        }
        stream.on("error", () => sock.destroy());
        stream.on("close", () => sock.destroy());
        // pg gọi socket.destroy() không graceful -> phải tự đóng channel,
        // nếu không sẽ rò session trên sshd cho tới khi hết giới hạn.
        sock.on("close", () => {
          try {
            stream.destroy();
          } catch {}
        });
        sock.pipe(stream);
        stream.pipe(sock);
      });
    } catch (e) {
      dead = e;
      sock.destroy();
    }
  });

  server.on("error", (e) => {
    dead = e;
    console.error(`[${label}] Lỗi listener cục bộ: ${e.message}`);
  });

  const localPort = await new Promise((resolve, reject) => {
    server.once("error", reject);
    // port 0 -> hệ điều hành cấp cổng trống, không bao giờ EADDRINUSE
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });

  return {
    localPort,
    get lastError() {
      return dead;
    },
    async close() {
      await new Promise((r) => server.close(r));
      try {
        ssh.end();
      } catch {}
    },
  };
}
