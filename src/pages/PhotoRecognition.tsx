import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RecipeCard from "@/components/RecipeCard";

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

// A phone photo is many megabytes; localStorage only holds ~5 MB for the whole
// site. Downscaling keeps the request small and the UI responsive.
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("This browser could not process the image"));
          return;
        }
        // Flatten transparency onto white so the photo does not analyse as black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("This image could not be processed"));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image"));
    };

    img.src = url;
  });

const PhotoRecognition = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dish, setDish] = useState<Dish | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? ((JSON.parse(raw) as { dish?: Dish | null }).dish ?? null) : null;
    } catch { return null; }
  });
  const { toast } = useToast();

  // Older builds cached the image itself in localStorage, which overflowed the
  // quota and silently broke saving recipes. Strip that key on first load.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { preview?: string; dish?: Dish | null };
      if ("preview" in parsed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ dish: parsed.dish ?? null }));
      }
    } catch {
      // Unreadable legacy value: nothing worth preserving, so leave it be.
    }
  }, []);

  // Only the small identified dish is persisted; the image stays in memory.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dish }));
    } catch {
      // Storage full or unavailable: remembering the result is optional.
    }
  }, [dish]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    try {
      setPreview(await compressImage(file));
    } catch (error) {
      toast({
        title: "Could not load image",
        description: error instanceof Error ? error.message : "Please try another photo",
        variant: "destructive",
      });
    } finally {
      // Allow re-picking the same file, which otherwise fires no change event.
      input.value = "";
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

    setLoading(true);
    setDish(null);
    try {
      const { data, error } = await supabase.functions.invoke('identify-dish', {
        body: { image: preview }
      });

      if (error) throw error;

      if (data?.dish) {
        setDish(data.dish);
        
        toast({
          title: "Dish identified!",
          description: `Detected: ${data.dish.name}`,
        });
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze image",
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
          <h1 className="text-4xl font-bold mb-4">Identify Any Dish</h1>
          <p className="text-muted-foreground text-lg">
            Upload or snap a photo to discover the recipe
          </p>
        </div>

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
            {/* RecipeCard shows its own confirmation toast when saved. */}
            <RecipeCard recipe={dish} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoRecognition;
