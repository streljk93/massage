import { NextResponse } from "next/server";

/**
 * Клиентский OAuth (idToken / accessToken) → `POST` на backend `/v1/auth/login/oauth`
 * (как `register`, без CORS / без обязательного `NEXT_PUBLIC_API_URL`).
 */
export async function POST(request: Request) {
  const base = process.env.AUTH_BACKEND_URL?.replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json(
      { message: "AUTH_BACKEND_URL is not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const res = await fetch(`${base}/v1/auth/login/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { message: text };
    }
  }

  return NextResponse.json(payload, { status: res.status });
}
