import { NextRequest, NextResponse } from "next/server";

const KENO_WORKER_URL = process.env.KENO_WORKER_URL ?? "http://localhost:8090";
const KENO_INTERNAL_SECRET = process.env.KENO_INTERNAL_SECRET;

export async function GET(req: NextRequest) {
  // Again: get userId from your verified session, not a query param, in production.
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const res = await fetch(`${KENO_WORKER_URL}/keno/history/${userId}`, {
    headers: KENO_INTERNAL_SECRET ? { "x-internal-secret": KENO_INTERNAL_SECRET } : {},
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
