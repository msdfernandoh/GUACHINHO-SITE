import { getSimuladorConfigsPublic } from "@/lib/simulador/config";
import { HomeV2Client } from "./home-v2-client";

export default async function HomePage() {
  const simuladorConfigs = await getSimuladorConfigsPublic();
  return <HomeV2Client simuladorConfigs={simuladorConfigs} />;
}
