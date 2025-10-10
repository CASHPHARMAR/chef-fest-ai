import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RecipeCard from "@/components/RecipeCard";

interface Recipe {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  cookTime: string;
  difficulty: string;
  cuisine: string;
}

const IngredientsInput = () => {
  const [ingredients, setIngredients] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const { toast } = useToast();

  const handleGenerateRecipes = async () => {
    if (!ingredients.trim()) {
      toast({
        title: "Missing ingredients",
        description: "Please enter some ingredients first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setRecipes([]);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipes', {
        body: { ingredients: ingredients.trim() }
      });

      if (error) throw error;

      if (data?.recipes) {
        setRecipes(data.recipes);
        toast({
          title: "Recipes generated!",
          description: `Found ${data.recipes.length} delicious recipes for you`,
        });
      }
    } catch (error: any) {
      console.error("Error generating recipes:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate recipes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pt-20">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">What's in your kitchen?</h1>
          <p className="text-muted-foreground text-lg">
            List your ingredients and discover amazing recipes you can make
          </p>
        </div>

        <Card className="p-6 shadow-warm">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Your Ingredients
              </label>
              <Textarea
                placeholder="E.g., chicken breast, garlic, tomatoes, basil..."
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Separate ingredients with commas
              </p>
            </div>

            <Button
              onClick={handleGenerateRecipes}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating recipes...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Find Recipes
                </>
              )}
            </Button>
          </div>
        </Card>

        {recipes.length > 0 && (
          <div className="mt-8 space-y-6">
            <h2 className="text-2xl font-bold">Recipe Suggestions</h2>
            {recipes.map((recipe, idx) => (
              <RecipeCard
                key={idx}
                recipe={recipe}
                onSave={() => {
                  toast({
                    title: "Recipe saved!",
                    description: "Find it in your Saved Recipes",
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IngredientsInput;
