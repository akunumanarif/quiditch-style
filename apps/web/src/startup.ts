import { Client, Room } from "@colyseus/sdk";

export function serverEndpoint(
  configured: string | undefined,
  page: { hostname: string; protocol: string },
  development = false,
): string {
  const value = configured?.trim();
  if (!value) {
    if (
      development ||
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(page.hostname)
    ) {
      const host =
        page.hostname.includes(":") && !page.hostname.startsWith("[")
          ? `[${page.hostname}]`
          : page.hostname;
      return `${page.protocol === "https:" ? "wss" : "ws"}://${host}:2567`;
    }
    throw new Error(
      "Server pertandingan belum dikonfigurasi. Pengelola perlu memasang VITE_SERVER_URL ke backend Colyseus HTTPS/WSS lalu deploy ulang. Quick practice tetap dapat dimainkan.",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Alamat server pertandingan tidak valid. Periksa VITE_SERVER_URL.",
    );
  }
  if (
    !["http:", "https:", "ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "VITE_SERVER_URL harus berupa alamat HTTP(S)/WS(S) tanpa kredensial, query, atau fragment.",
    );
  if (page.protocol === "https:" && ["http:", "ws:"].includes(url.protocol))
    throw new Error(
      "Halaman HTTPS memerlukan backend HTTPS/WSS. Koneksi server tidak aman akan diblokir browser.",
    );
  url.protocol = ["https:", "wss:"].includes(url.protocol) ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}

export function withDeadline<T>(
  operation: Promise<T>,
  milliseconds: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
      onTimeout?.();
    }, milliseconds);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Track the SDK-created room so a hung WebSocket handshake can be closed as well
// as aborting matchmaking HTTP. A late connection must never adopt a new UI session.
class StartupClient extends Client {
  pending?: Room;
  protected override createRoom<T>(name: string) {
    const room = super.createRoom<T>(name);
    this.pending = room;
    return room;
  }
  cancel() {
    if (this.pending) {
      void this.pending.leave().catch(() => {});
      this.pending.connection?.close();
    }
  }
}
export async function openGameRoom(
  endpoint: string,
  options: {
    kind: "create" | "join";
    name: string;
    id?: string;
    invite?: string;
  },
  timeoutMs = 15000,
): Promise<Room> {
  const client = new StartupClient(endpoint);
  const controller = new AbortController();
  client.http.options.signal = controller.signal;
  const operation =
    options.kind === "create"
      ? client.create("match", { name: options.name })
      : client.joinById(options.id!, {
          name: options.name,
          invite: options.invite,
        });
  try {
    return await withDeadline(
      operation,
      timeoutMs,
      "Server pertandingan tidak merespons. Periksa koneksi internet dan status backend, lalu coba lagi.",
      () => {
        controller.abort();
        client.cancel();
      },
    );
  } catch (error) {
    controller.abort();
    client.cancel();
    throw error;
  }
}
