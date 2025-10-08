import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import Navigation from "@/components/Navigation";

const SavedRecipes = () => {
  // TODO: Fetch saved recipes from database
  const savedRecipes: any[] = [];

  return (
    <div className="min-h-screen pb-20 md:pt-20">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Saved Recipes</h1>
          <p className="text-muted-foreground text-lg">
            Your personal recipe collection
          </p>
        </div>

        {savedRecipes.length === 0 ? (
          <Card className="p-12 text-center shadow-warm max-w-2xl mx-auto">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No saved recipes yet</h3>
            <p className="text-muted-foreground">
              Start generating recipes and save your favorites here!
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Recipe cards will be mapped here */}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedRecipes;
