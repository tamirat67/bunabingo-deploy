import { NextRequest, NextResponse } from "next/server";

const KENO_WORKER_URL = process.env.KENO_WORKER_URL ?? "http://localhost:8090";
const KENO_INTERNAL_SECRET = process.env.KENO_INTERNAL_SECRET;

export async function GET(req: NextRequest) {
  const sample = req.nextUrl.searchParams.get("sampleRounds") ?? "100";
  try {
    const res = await fetch(
      `${KENO_WORKER_URL}/keno/analytics/hot-cold?sampleRounds=${sample}`,
      {
        headers: KENO_INTERNAL_SECRET
          ? { "x-internal-secret": KENO_INTERNAL_SECRET }
          : {},
        cache: "no-store",
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ hotNumbers: [], coldNumbers: [], sampleRounds: 0, frequency: {} });
  }
}
