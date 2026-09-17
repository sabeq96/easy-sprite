import { Moon, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { useThemeStore, type Theme } from "@/stores/useThemeStore";

export function ThemeSection() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Pixel art reads best against a dark surface.</CardDescription>
      </CardHeader>

      <CardContent>
        <ToggleGroup
          value={[theme]}
          onValueChange={([value]) => value && setTheme(value as Theme)}
          aria-label="Theme"
        >
          <Toggle value="dark" size="sm">
            <Moon />
            Dark
          </Toggle>
          <Toggle value="light" size="sm">
            <Sun />
            Light
          </Toggle>
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
