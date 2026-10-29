import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat, Home, Camera, BookOpen } from "lucide-react";

const Navigation = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto bg-card/95 backdrop-blur-sm border-t md:border-b md:border-t-0 border-border z-50 shadow-warm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl">
            <ChefHat className="h-6 w-6" />
            <span className="hidden md:inline">Chef Fest</span>
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/">
              <Button
                variant={isActive("/") ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                <span className="hidden md:inline">Home</span>
              </Button>
            </Link>

            <Link to="/photo">
              <Button
                variant={isActive("/photo") ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden md:inline">Scan</span>
              </Button>
            </Link>

            <Link to="/ingredients">
              <Button
                variant={isActive("/ingredients") ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden md:inline">Generate</span>
              </Button>
            </Link>

            <Link to="/recipes">
              <Button
                variant={isActive("/recipes") ? "default" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden md:inline">Saved</span>
              </Button>
            </Link>

          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
