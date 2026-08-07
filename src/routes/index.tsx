import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/components/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chamados HD ANCORA · Análise Comparativa" },
      {
        name: "description",
        content:
          "Dashboard executivo de análise comparativa dos chamados do Help Desk da Rede Ancora: volumes, procedência, ações e desempenho operacional.",
      },
      { property: "og:title", content: "Chamados HD ANCORA · Análise Comparativa" },
      {
        property: "og:description",
        content:
          "Dashboard executivo de análise comparativa dos chamados do Help Desk da Rede Ancora: volumes, procedência, ações e desempenho operacional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Dashboard />;
}
