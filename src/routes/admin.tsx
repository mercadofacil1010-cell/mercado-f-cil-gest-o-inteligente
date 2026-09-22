import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminPanel } from "@/components/admin-panel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração da Plataforma | Mercado Fácil" },
      { name: "description", content: "Área exclusiva do proprietário da plataforma Mercado Fácil." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const navigate = useNavigate();
  return <AdminPanel onExit={() => void navigate({ to: "/" })} />;
}
