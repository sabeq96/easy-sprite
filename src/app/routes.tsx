import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "@/app/AppLayout";
import { RouteErrorBoundary } from "@/app/RouteErrorBoundary";
import { SpritesheetBuilderPage } from "@/components/builder/SpritesheetBuilderPage";
import { NotFoundPage } from "@/components/common/NotFoundPage";
import { EditorPage } from "@/components/editor/EditorPage";
import { SpriteManagerPage } from "@/components/manager/SpriteManagerPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { ROUTES } from "@/constants/routes";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RouteErrorBoundary />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={ROUTES.sprites} replace />} />
          <Route path="sprites" element={<SpriteManagerPage />} />
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
