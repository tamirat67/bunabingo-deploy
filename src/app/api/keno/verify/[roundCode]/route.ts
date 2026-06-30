import { NextRequest, NextResponse } from "next/server";

const KENO_WORKER_URL = process.env.KENO_WORKER_URL ?? "http://localhost:8090";
const KENO_INTERNAL_SECRET = process.env.KENO_INTERNAL_SECRET;

export async function GET(req: NextRequest, { params }: { params: { roundCode: string } }) {
  const { roundCode } = params;

  if (!roundCode) {
    return NextResponse.json({ error: "Missing roundCode" }, { status: 400 });
  }

  try {
    const res = await fetch(`${KENO_WORKER_URL}/keno/verify/${roundCode}`, {
      headers: KENO_INTERNAL_SECRET ? { "x-internal-secret": KENO_INTERNAL_SECRET } : {},
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error fetching verification data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
