import { Images, Settings } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/constants/routes";

const NAV_ITEMS = [
  { to: ROUTES.sprites, label: "Sprites", icon: Images },
  { to: ROUTES.settings, label: "Settings", icon: Settings },
];

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-sm font-semibold tracking-tight">Sprite Editor</span>
        <Separator orientation="vertical" className="h-5" />

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Button
              key={to}
              size="sm"
              variant={pathname.startsWith(to) ? "secondary" : "ghost"}
              // Base UI needs this whenever the rendered element is not a native <button>.
              nativeButton={false}
              render={
                <Link to={to}>
                  <Icon />
                  {label}
                </Link>
              }
            />
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
