import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "your-existing-auth"; // <-- use whatever auth you already have

const KENO_WORKER_URL = process.env.KENO_WORKER_URL ?? "http://localhost:8090";
const KENO_INTERNAL_SECRET = process.env.KENO_INTERNAL_SECRET;

export async function POST(req: NextRequest) {
  // ---- AUTH: do this with your EXISTING session/JWT check, not a body field ----
  // const session = await getServerSession();
  // if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // const userId = session.user.id;

  const body = await req.json();
  const userId = body.userId; // TEMP: replace with the verified session userId above

  const res = await fetch(`${KENO_WORKER_URL}/keno/ticket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(KENO_INTERNAL_SECRET ? { "x-internal-secret": KENO_INTERNAL_SECRET } : {}),
    },
    body: JSON.stringify({
      userId,
      picks: body.picks,
      stakeCents: body.stakeCents,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
