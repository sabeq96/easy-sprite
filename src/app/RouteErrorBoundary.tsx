import { Outlet, useLocation } from "react-router";
import { CrashPage } from "@/components/common/CrashPage";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

/**
 * Pathless layout route: a page that throws shows CrashPage, and navigating away tries again.
 * Reset by `resetKey`, not a `key`, so a healthy app shell is not remounted on every navigation.
 */
export function RouteErrorBoundary() {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname} fallback={(error) => <CrashPage error={error} />}>
      <Outlet />
    </ErrorBoundary>
  );
}
