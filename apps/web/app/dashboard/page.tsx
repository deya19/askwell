import { redirect } from "next/navigation";
import { PROJECTS_PATH } from "@/components/dashboard/nav-items";

/** The dashboard opens on the projects list. */
export default function DashboardPage() {
  redirect(PROJECTS_PATH);
}
