import { Link, useLocation } from "react-router-dom";
import { ChefHat, Home, Camera, BookOpen, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/ingredients", icon: ChefHat, label: "Cook" },
    { path: "/photo", icon: Camera, label: "Scan" },
    { path: "/recipes", icon: BookOpen, label: "Saved" },
    { path: "/admin", icon: UserCog, label: "Admin" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-warm z-50 md:top-0 md:bottom-auto">
      <div className="container mx-auto px-4">
        <div className="flex justify-around md:justify-center md:gap-8 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-smooth",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
