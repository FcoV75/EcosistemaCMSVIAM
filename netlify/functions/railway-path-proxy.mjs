const RAILWAY_API = "https://ecosistemacmsviam-production.up.railway.app";
const ALLOWED_PREFIXES = ["/health", "/renderizar", "/transcribir", "/estudio", "/status", "/descargar"];

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "";
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return Response.json({ error: "Ruta no permitida en proxy." }, { status: 403 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const body = hasBody ? await req.arrayBuffer() : undefined;
    const headers = { Accept: "application/json" };
    if (contentType) headers["Content-Type"] = contentType;

    const upstream = await fetch(`${RAILWAY_API}${path}`, {
      method: req.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return Response.json(
      { error: "Proxy Railway falló", detalle: err.message },
      { status: 502 }
    );
  }
};
