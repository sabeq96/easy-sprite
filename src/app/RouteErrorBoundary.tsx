import { Outlet, useLocation } from "react-router";
import { CrashPage } from "@/components/common/CrashPage";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

/** Pathless layout route: a page that throws shows CrashPage, and navigating away resets it. */
export function RouteErrorBoundary() {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary key={pathname} fallback={(error) => <CrashPage error={error} />}>
      <Outlet />
    </ErrorBoundary>
  );
}
