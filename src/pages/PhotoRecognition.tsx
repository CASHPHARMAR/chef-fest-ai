import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Loader2, AlertCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RecipeCard from "@/components/RecipeCard";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Dish {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  cuisine: string;
  difficulty: string;
  cookTime: string;
}

const STORAGE_KEY = "chef-fest:photo-search";

const PhotoRecognition = () => {
  const [preview, setPreview] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw).preview ?? null) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [dish, setDish] = useState<Dish | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw).dish ?? null) : null;
    } catch { return null; }
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    guestRecipeCount, 
    incrementGuestCount, 
    canGenerateRecipe, 
    hasReachedLimit,
    showAuthModal,
    setShowAuthModal,
    maxRecipes 
  } = useGuestMode();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ preview, dish }));
    } catch {}
  }, [preview, dish]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!preview) {
      toast({
        title: "No image selected",
        description: "Please upload or capture a photo first",
        variant: "destructive",
      });
      return;
    }

    // Check guest limit
    if (!user && hasReachedLimit()) {
      setShowAuthModal(true);
      toast({
        title: "Preview limit reached",
        description: "Sign up to identify unlimited dishes!",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setDish(null);
    try {
      const { data, error } = await supabase.functions.invoke('identify-dish', {
        body: { image: preview }
      });

      if (error) throw error;

      if (data?.dish) {
        setDish(data.dish);
        
        // Increment guest count if not logged in
        if (!user) {
          incrementGuestCount();
        }
        
        toast({
          title: "Dish identified!",
          description: `Detected: ${data.dish.name}`,
        });
      }
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze image",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-8">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Identify Any Dish</h1>
          <p className="text-muted-foreground text-lg">
            Upload or snap a photo to discover the recipe
          </p>
        </div>

        {!user && (
          <Alert className="mb-6 border-primary/20 bg-primary/5 animate-in fade-in-0 slide-in-from-top-4">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Guest Preview Mode:</strong> You can identify <strong>{maxRecipes - guestRecipeCount}</strong> more dish{maxRecipes - guestRecipeCount !== 1 ? 'es' : ''} before signing up.
            </AlertDescription>
          </Alert>
        )}

        <Card className="p-6 shadow-warm">
          <div className="space-y-6">
            {preview ? (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={preview}
                  alt="Food preview"
                  className="w-full h-64 object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPreview(null)}
                  className="absolute top-2 right-2"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No image selected
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button variant="outline" className="w-full">
                  <Upload className="h-5 w-5" />
                  Upload Photo
                </Button>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button variant="outline" className="w-full">
                  <Camera className="h-5 w-5" />
                  Take Photo
                </Button>
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!preview || loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Identify Dish"
              )}
            </Button>
          </div>
        </Card>

        {dish && (
          <div className="mt-8 animate-in fade-in-0 slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold mb-4">Identified Dish</h2>
            <RecipeCard
              recipe={dish}
              onSave={() => {
                toast({
                  title: "Recipe saved!",
                  description: "Find it in your Saved Recipes",
                });
              }}
            />
          </div>
        )}
      </div>
      
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        trigger={guestRecipeCount === 1 ? "first_recipe" : "limit_reached"}
      />
    </div>
  );
};

export default PhotoRecognition;
