import { MissionWorkspace } from "@/components/mission-workspace";
export default async function MissionPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <MissionWorkspace runId={runId} />;
}
