import FastKenoBoard from "@/components/FastKenoBoard";
// import { getServerSession } from "your-existing-auth"; // <-- get the real logged-in user here

export default async function KenoPage() {
  // const session = await getServerSession();
  // if (!session) redirect("/login");
  const userId = 1; // TEMP — replace with session.user.id

  return (
    <main className="min-h-screen bg-slate-950">
      <FastKenoBoard userId={userId} />
    </main>
  );
}
