const RAILWAY_API = "https://ecosistemacmsviam-production.up.railway.app";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    const body = await req.arrayBuffer();

    const upstream = await fetch(`${RAILWAY_API}/renderizar`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body
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
      { error: "Proxy de renderizado falló", detalle: err.message },
      { status: 502 }
    );
  }
};
