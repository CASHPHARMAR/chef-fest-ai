export interface SavedRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  cook_time: string;
  difficulty: string;
  cuisine: string;
  created_at: string;
}

const KEY = "chef_fest_saved_recipes";

export const getSavedRecipes = (): SavedRecipe[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveRecipe = (r: Omit<SavedRecipe, "id" | "created_at">) => {
  const list = getSavedRecipes();
  list.unshift({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(list));
};

export const deleteSavedRecipe = (id: string) => {
  localStorage.setItem(KEY, JSON.stringify(getSavedRecipes().filter((r) => r.id !== id)));
};
