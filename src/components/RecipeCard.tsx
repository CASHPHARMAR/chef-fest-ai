import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChefHat, Heart } from "lucide-react";

interface Recipe {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  cookTime: string;
  difficulty: string;
  cuisine: string;
}

interface RecipeCardProps {
  recipe: Recipe;
  onSave?: () => void;
}

const RecipeCard = ({ recipe, onSave }: RecipeCardProps) => {
  return (
    <Card className="overflow-hidden shadow-warm animate-fade-in">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">{recipe.name}</h3>
            <p className="text-muted-foreground mb-4">{recipe.description}</p>
          </div>
          {onSave && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSave}
              className="hover:text-primary"
            >
              <Heart className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {recipe.cookTime}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <ChefHat className="h-3 w-3" />
            {recipe.difficulty}
          </Badge>
          <Badge variant="outline">{recipe.cuisine}</Badge>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Ingredients</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {recipe.ingredients.map((ingredient, idx) => (
                <li key={idx} className="text-muted-foreground">
                  {ingredient}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Instructions</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {recipe.steps.map((step, idx) => (
                <li key={idx} className="text-muted-foreground">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RecipeCard;
