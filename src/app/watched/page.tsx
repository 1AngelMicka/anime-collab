import Title from "@/components/Title";
import WatchedGrid from "@/components/WatchedGrid";

export const dynamic = "force-dynamic";

export default function WatchedPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <Title>Animés vus</Title>
      <WatchedGrid />
    </main>
  );
}
