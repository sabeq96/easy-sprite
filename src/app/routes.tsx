import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "@/app/AppLayout";
import { RouteErrorBoundary } from "@/app/RouteErrorBoundary";
import { SpritesheetBuilderPage } from "@/components/builder/SpritesheetBuilderPage";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { LibraryPage } from "@/components/library/LibraryPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { ROUTES } from "@/constants/routes";
import { EditorPage } from "@/editor/shell/EditorPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RouteErrorBoundary />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={ROUTES.sprites} replace />} />
          <Route path="sprites" element={<LibraryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* The editor and the spritesheet builder are full-bleed, so they sit outside the padded app shell. */}
        <Route path="sprites/:spriteId" element={<EditorPage />} />
        <Route path="spritesheets/:spritesheetId" element={<SpritesheetBuilderPage />} />
      </Route>
    </Routes>
  );
}
