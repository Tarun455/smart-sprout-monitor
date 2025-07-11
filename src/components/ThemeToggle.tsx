
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="outline" 
      size="sm" 
      onClick={toggleTheme} 
      className="rounded-full w-16 flex justify-center"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Sun className="h-[1rem] w-[1rem] rotate-0 scale-100 transition-all text-amber-500" />
      ) : (
        <Moon className="h-[1rem] w-[1rem] rotate-0 scale-100 transition-all text-blue-400" />
      )}
    </Button>
  );
}
