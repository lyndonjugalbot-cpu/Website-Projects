import { useConvexAuth, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { api } from "../convex/_generated/api";
import { AdminApp } from "./components/AdminApp";
import { EmployeeApp } from "./components/EmployeeApp";
import { LoginPage } from "./components/LoginPage";
import { Shell } from "./components/Shell";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoaderCircle size={24} className="animate-spin text-brand-600" />
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <LoginPage />;
  if (currentUser === undefined) return <FullPageLoader />;

  if (!currentUser || !currentUser.role) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your account doesn&apos;t have access yet. Please contact your Admin / Team Leader.
        </p>
      </div>
    );
  }

  return (
    <Shell user={currentUser}>
      {currentUser.role === "admin" ? <AdminApp /> : <EmployeeApp user={currentUser} />}
    </Shell>
  );
}
