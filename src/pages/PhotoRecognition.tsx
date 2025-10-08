import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useToast } from "@/hooks/use-toast";

const PhotoRecognition = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

    setLoading(true);
    try {
      // TODO: Call AI edge function for image recognition
      toast({
        title: "Photo recognition coming soon!",
        description: "AI integration will be added next",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze image",
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

        {/* Results will be shown here */}
        <div className="mt-8">
          {/* Placeholder for dish identification results */}
        </div>
      </div>
    </div>
  );
};

export default PhotoRecognition;
