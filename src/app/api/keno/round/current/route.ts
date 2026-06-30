import { NextResponse } from "next/server";

const KENO_WORKER_URL = process.env.KENO_WORKER_URL ?? "http://localhost:8090";
const KENO_INTERNAL_SECRET = process.env.KENO_INTERNAL_SECRET;

export async function GET() {
  const res = await fetch(`${KENO_WORKER_URL}/keno/round/current`, {
    headers: KENO_INTERNAL_SECRET ? { "x-internal-secret": KENO_INTERNAL_SECRET } : {},
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
