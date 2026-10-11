/** NDJSON streaming con pings: evita Inactivity Timeout de Safari/Chrome. */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ecosistema-Token',
  'Cache-Control': 'no-cache, no-transform',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * @param {(write: (obj: object) => void) => Promise<object>} trabajoAsync
 * @param {{ pingMs?: number, statusInicial?: string }} [opts]
 */
export function ndjsonEstudioResponse(trabajoAsync, opts = {}) {
  const pingMs = Number(opts.pingMs) > 1000 ? Number(opts.pingMs) : 3000;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      const ping = setInterval(() => {
        try {
          write({ type: 'ping', t: Date.now() });
        } catch {
          /* stream cerrado */
        }
      }, pingMs);
      try {
        if (opts.statusInicial) write({ type: 'status', msg: opts.statusInicial });
        const result = await trabajoAsync(write);
        write({ type: 'result', ...result });
      } catch (err) {
        write({
          type: 'result',
          success: false,
          error: String(err?.message || err),
        });
      } finally {
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/x-ndjson; charset=utf-8',
    },
  });
}
