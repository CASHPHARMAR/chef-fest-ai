import { Link, useLocation } from "react-router-dom";
import { ChefHat, Home, Camera, Sparkles, BookOpen, Shield, LogOut, LogIn, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const Navigation = () => {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const items: { to: string; label: string; icon: typeof Home }[] = [
    { to: "/", label: "Home", icon: Home },
    { to: "/photo", label: "Scan", icon: Camera },
    { to: "/ingredients", label: "Generate", icon: Sparkles },
    { to: "/recipes", label: "Saved", icon: BookOpen },
  ];
  if (user) items.push({ to: "/profile", label: "Profile", icon: User });
  if (isAdmin) items.push({ to: "/admin", label: "Admin", icon: Shield });

  return (
    <nav className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-5xl">
      <div className="relative flex items-stretch">
        {/* Chef hat badge (handle-side tag) */}
        <div className="hidden sm:flex items-center pr-3">
          <div className="h-11 w-11 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-warm">
            <ChefHat className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Knife-shaped blade */}
        <div
          className="relative flex-1 flex items-center h-14 bg-card/95 backdrop-blur-md border border-border shadow-warm overflow-hidden"
          style={{
            clipPath:
              "polygon(0 50%, 14px 0, calc(100% - 56px) 0, 100% 50%, calc(100% - 56px) 100%, 14px 100%)",
          }}
        >
          {/* Brand chef hat icon (blade tip area) */}
          <div className="pl-6 pr-2 sm:pl-8">
            <ChefHat className="h-5 w-5 text-primary/80" />
          </div>

          {/* Nav items */}
          <div className="flex-1 flex items-center justify-around gap-1 px-2 overflow-x-auto no-scrollbar">
            {items.map(({ to, label, icon: Icon }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[52px] transition-smooth",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-semibold tracking-wide uppercase">
                    {label}
                  </span>
                  {active && (
                    <span className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            {user ? (
              <button
                onClick={signOut}
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[52px] text-muted-foreground hover:text-foreground transition-smooth"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-[10px] font-semibold tracking-wide uppercase">Out</span>
              </button>
            ) : (
              <Link
                to="/auth"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[52px] transition-smooth",
                  isActive("/auth") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LogIn className="h-4 w-4" />
                <span className="text-[10px] font-semibold tracking-wide uppercase">Sign In</span>
              </Link>
            )}
          </div>

          {/* Wooden handle */}
          <div
            className="absolute right-0 top-0 h-full w-14 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, hsl(25 55% 30%), hsl(20 45% 22%) 60%, hsl(25 50% 28%))",
              clipPath: "polygon(0 0, 100% 25%, 100% 75%, 0 100%)",
            }}
          >
            <div className="absolute inset-y-2 right-2 left-3 rounded-sm border border-amber-900/40 opacity-40" />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
