import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, AlertCircle, HelpCircle, CloudOff } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RecipeCard from "@/components/RecipeCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  checkFoodInput,
  NOT_FOOD_MESSAGE,
  UNCERTAIN_MESSAGE,
  UNAVAILABLE_MESSAGE,
} from "../../supabase/functions/_shared/foodValidation";

interface Recipe {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  cookTime: string;
  difficulty: string;
  cuisine: string;
}

type NoticeKind = "invalid" | "uncertain" | "unavailable";

const STORAGE_KEY = "chef-fest:ingredients-search";

const noticeIcon = (kind: NoticeKind) => {
  if (kind === "uncertain") return <HelpCircle className="h-4 w-4" />;
  if (kind === "unavailable") return <CloudOff className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
};

/**
 * Reads the friendly message out of an edge-function error response without
 * ever surfacing a raw provider error, stack trace or status code.
 */
const readErrorNotice = async (error: unknown): Promise<NoticeKind> => {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const payload = await context.json() as { status?: string };
      if (payload?.status === "uncertain") return "uncertain";
      if (payload?.status === "invalid") return "invalid";
    } catch {
      // Body was empty or not JSON: fall through to the safe default.
    }
  }
  return "unavailable";
};

const IngredientsInput = () => {
  const [ingredients, setIngredients] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw).ingredients ?? "") : "";
    } catch { return ""; }
  });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<NoticeKind>("invalid");
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw).recipes ?? []) : [];
    } catch { return []; }
  });
  const { toast } = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ingredients, recipes }));
    } catch {
      // Storage is full or unavailable: restoring the last search is a
      // convenience only, so failing to persist it must not break the page.
    }
  }, [ingredients, recipes]);

  const showNotice = (kind: NoticeKind, message: string) => {
    setNoticeKind(kind);
    setNotice(message);
  };

  const handleGenerateRecipes = async () => {
    // The button is disabled while loading, but a fast double submit could
    // still slip through before React re-renders.
    if (loading) return;

    // Layer A: never spend an AI request on obviously invalid input.
    const check = checkFoodInput(ingredients);
    if (check.ok === false) {
      setRecipes([]);
      showNotice("invalid", check.message);
      toast({
        title: check.problem === "empty" ? "Missing ingredients" : "Invalid input",
        description: check.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setRecipes([]);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipes', {
        body: { ingredients: check.value }
      });

      if (error) {
        const kind = await readErrorNotice(error);
        const message = kind === "uncertain"
          ? UNCERTAIN_MESSAGE
          : kind === "invalid"
            ? NOT_FOOD_MESSAGE
            : UNAVAILABLE_MESSAGE;
        showNotice(kind, message);
        toast({ title: "No recipes yet", description: message });
        return;
      }

      // Server-side verdicts. "not_food" is the older shape and stays supported
      // so a partially deployed backend cannot show a broken page.
      if (data?.status === "invalid" || data?.status === "not_food") {
        showNotice("invalid", NOT_FOOD_MESSAGE);
        toast({ title: "No recipes found", description: NOT_FOOD_MESSAGE });
        return;
      }

      if (data?.status === "uncertain") {
        showNotice("uncertain", UNCERTAIN_MESSAGE);
        toast({ title: "Could you clarify?", description: UNCERTAIN_MESSAGE });
        return;
      }

      if (data?.status === "unavailable") {
        showNotice("unavailable", UNAVAILABLE_MESSAGE);
        toast({ title: "Please try again", description: UNAVAILABLE_MESSAGE });
        return;
      }

      if (data?.status === "ok" && Array.isArray(data.recipes) && data.recipes.length > 0) {
        setRecipes(data.recipes);
        toast({
          title: "Recipes generated!",
          description: `Found ${data.recipes.length} delicious recipes for you`,
        });
        return;
      }

      // A response we do not recognise is treated as a temporary failure rather
      // than rendering half-valid data.
      showNotice("unavailable", UNAVAILABLE_MESSAGE);
      toast({ title: "Please try again", description: UNAVAILABLE_MESSAGE });
    } catch (error) {
      console.error("Error generating recipes:", error);
      showNotice("unavailable", UNAVAILABLE_MESSAGE);
      toast({
        title: "Please try again",
        description: UNAVAILABLE_MESSAGE,
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
                onChange={(e) => {
                  setIngredients(e.target.value);
                  setNotice(null);
                }}
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

        {notice && (
          <Alert className="mt-6" aria-live="polite">
            {noticeIcon(noticeKind)}
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {recipes.length > 0 && (
          <div className="mt-8 space-y-6">
            <h2 className="text-2xl font-bold">Recipe Suggestions</h2>
            {recipes.map((recipe, idx) => (
              // RecipeCard shows its own confirmation toast when saved.
              <RecipeCard key={idx} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IngredientsInput;
