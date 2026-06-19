import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2, Clock, ChefHat, Heart, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AuthModal from "@/components/AuthModal";

const SavedRecipes = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [fetchingRecipes, setFetchingRecipes] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRecipes();
    }
  }, [user]);

  const fetchRecipes = async () => {
    if (!user) return;
    
    setFetchingRecipes(true);
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching recipes:", error);
      toast.error("Failed to load recipes");
    } else {
      setSavedRecipes(data || []);
    }
    setFetchingRecipes(false);
  };

  const deleteRecipe = async (recipeId: string) => {
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId);

    if (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
    } else {
      toast.success("Recipe deleted");
      fetchRecipes();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-8">
        <Navigation />
        <div className="container mx-auto px-4 py-8 text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-8">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center shadow-warm max-w-2xl mx-auto animate-fade-in">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Heart className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Your Personal Cookbook Awaits!</h2>
            <p className="text-muted-foreground text-lg mb-6">
              Sign up to save your favorite recipes and access them anytime, anywhere.
            </p>
            <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                  <BookOpen className="h-4 w-4 text-accent" />
                </div>
                <span className="text-muted-foreground">Save unlimited recipes to your collection</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <span className="text-muted-foreground">Access your recipes from any device</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                  <ChefHat className="h-4 w-4 text-accent" />
                </div>
                <span className="text-muted-foreground">Build your personal cooking library</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth?mode=signup")}
                className="shadow-warm hover:shadow-glow transition-all duration-300"
              >
                Create Free Account
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/auth?mode=login")}
              >
                Already have an account? Login
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (fetchingRecipes) {
    return (
      <div className="min-h-screen pt-24 pb-8">
        <Navigation />
        <div className="container mx-auto px-4 py-8 text-center">
          <p>Loading recipes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-8">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Saved Recipes</h1>
          <p className="text-muted-foreground text-lg">
            Your personal recipe collection ({savedRecipes.length} recipes)
          </p>
        </div>

        {savedRecipes.length === 0 ? (
          <Card className="p-12 text-center shadow-warm max-w-2xl mx-auto">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No saved recipes yet</h3>
            <p className="text-muted-foreground mb-6">
              Start generating recipes and save your favorites here!
            </p>
            <Button onClick={() => navigate("/ingredients")}>
              Generate Recipes
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedRecipes.map((recipe) => (
              <Card key={recipe.id} className="p-6 shadow-warm hover:shadow-lg transition-smooth">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">{recipe.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRecipe(recipe.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {recipe.description && (
                  <p className="text-muted-foreground mb-4 line-clamp-2">
                    {recipe.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {recipe.cook_time && (
                    <span className="inline-flex items-center text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                      <Clock className="h-3 w-3 mr-1" />
                      {recipe.cook_time}
                    </span>
                  )}
                  {recipe.difficulty && (
                    <span className="inline-flex items-center text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {recipe.difficulty}
                    </span>
                  )}
                  {recipe.cuisine && (
                    <span className="inline-flex items-center text-xs bg-accent text-accent-foreground px-2 py-1 rounded">
                      <ChefHat className="h-3 w-3 mr-1" />
                      {recipe.cuisine}
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold mb-2 text-sm">Ingredients:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                    {recipe.ingredients?.slice(0, 3).map((ingredient: string, idx: number) => (
                      <li key={idx}>• {ingredient}</li>
                    ))}
                    {recipe.ingredients?.length > 3 && (
                      <li className="text-primary">+ {recipe.ingredients.length - 3} more</li>
                    )}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-sm">Steps:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                    {recipe.steps?.slice(0, 2).map((step: string, idx: number) => (
                      <li key={idx}>{idx + 1}. {step}</li>
                    ))}
                    {recipe.steps?.length > 2 && (
                      <li className="text-primary">+ {recipe.steps.length - 2} more steps</li>
                    )}
                  </ol>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedRecipes;
