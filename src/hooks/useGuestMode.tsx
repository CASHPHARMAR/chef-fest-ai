import { useState, useEffect } from "react";

const GUEST_RECIPE_COUNT_KEY = "chef_fest_guest_recipes";
const MAX_GUEST_RECIPES = 2;

export const useGuestMode = () => {
  const [guestRecipeCount, setGuestRecipeCount] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const count = parseInt(localStorage.getItem(GUEST_RECIPE_COUNT_KEY) || "0");
    setGuestRecipeCount(count);
  }, []);

  const incrementGuestCount = () => {
    const newCount = guestRecipeCount + 1;
    setGuestRecipeCount(newCount);
    localStorage.setItem(GUEST_RECIPE_COUNT_KEY, newCount.toString());
    
    // Show modal after first recipe
    if (newCount === 1) {
      setShowAuthModal(true);
    }
    
    return newCount;
  };

  const canGenerateRecipe = () => {
    return guestRecipeCount < MAX_GUEST_RECIPES;
  };

  const resetGuestCount = () => {
    localStorage.removeItem(GUEST_RECIPE_COUNT_KEY);
    setGuestRecipeCount(0);
  };

  const hasReachedLimit = () => {
    return guestRecipeCount >= MAX_GUEST_RECIPES;
  };

  return {
    guestRecipeCount,
    incrementGuestCount,
    canGenerateRecipe,
    resetGuestCount,
    hasReachedLimit,
    showAuthModal,
    setShowAuthModal,
    maxRecipes: MAX_GUEST_RECIPES,
  };
};
