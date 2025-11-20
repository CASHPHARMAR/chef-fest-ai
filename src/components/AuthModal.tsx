import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ChefHat, Sparkles, Heart, BookOpen } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  trigger?: "first_recipe" | "save_recipe" | "limit_reached" | "dashboard";
}

const AuthModal = ({ 
  open, 
  onOpenChange, 
  title,
  description,
  trigger = "first_recipe" 
}: AuthModalProps) => {
  const navigate = useNavigate();

  const getContent = () => {
    switch (trigger) {
      case "first_recipe":
        return {
          title: title || "Enjoyed your first recipe? 🎉",
          description: description || "Create an account to save your recipes and unlock full features!",
          features: [
            { icon: Heart, text: "Save unlimited recipes" },
            { icon: BookOpen, text: "Access your recipes anywhere" },
            { icon: Sparkles, text: "Get personalized recommendations" },
          ]
        };
      case "save_recipe":
        return {
          title: title || "Save this delicious recipe! 😋",
          description: description || "Sign up to save recipes and build your personal cookbook.",
          features: [
            { icon: Heart, text: "Save unlimited recipes" },
            { icon: BookOpen, text: "Organize your favorites" },
            { icon: ChefHat, text: "Rate and review dishes" },
          ]
        };
      case "limit_reached":
        return {
          title: title || "You've reached your preview limit! 🍳",
          description: description || "Create a free account to continue generating unlimited recipes.",
          features: [
            { icon: Sparkles, text: "Unlimited recipe generation" },
            { icon: Heart, text: "Save and organize recipes" },
            { icon: BookOpen, text: "Access your cookbook anywhere" },
          ]
        };
      case "dashboard":
        return {
          title: title || "Sign in to access your dashboard 🔐",
          description: description || "Create an account or log in to view your saved recipes and profile.",
          features: [
            { icon: BookOpen, text: "View saved recipes" },
            { icon: Heart, text: "Manage favorites" },
            { icon: ChefHat, text: "Track your cooking journey" },
          ]
        };
      default:
        return {
          title: "Join Chef Fest! 🎉",
          description: "Create an account to unlock all features.",
          features: [
            { icon: Heart, text: "Save recipes" },
            { icon: Sparkles, text: "AI-powered suggestions" },
            { icon: BookOpen, text: "Personal cookbook" },
          ]
        };
    }
  };

  const content = getContent();

  const handleSignup = () => {
    navigate("/auth?mode=signup");
    onOpenChange(false);
  };

  const handleLogin = () => {
    navigate("/auth?mode=login");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-300">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ChefHat className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">{content.title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {content.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {content.features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm animate-in fade-in-0 slide-in-from-left-4" style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                <feature.icon className="h-4 w-4 text-accent" />
              </div>
              <span className="text-muted-foreground">{feature.text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button 
            onClick={handleSignup}
            size="lg"
            className="w-full shadow-warm hover:shadow-glow transition-all duration-300"
          >
            Create Free Account
          </Button>
          <Button 
            onClick={handleLogin}
            variant="outline"
            size="lg"
            className="w-full"
          >
            Already have an account? Login
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
