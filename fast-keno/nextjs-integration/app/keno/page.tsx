import FastKenoBoard from "@/components/FastKenoBoard";
// import { getServerSession } from "your-existing-auth";

export default async function KenoPage() {
  // const session = await getServerSession();
  // if (!session) redirect("/login");
  const userId = "demo-user"; // TEMP — replace with session.user.id
  const balance = 0;           // TEMP — pass real ETB balance from your wallet

  return (
    <main style={{ minHeight: "100dvh", background: "#0c1a11" }}>
      <FastKenoBoard userId={userId} balance={balance} />
    </main>
  );
}
