import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat, Sparkles, Camera, Instagram } from "lucide-react";
import Navigation from "@/components/Navigation";
import heroImage from "@/assets/hero-cooking.jpg";

const Home = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 gradient-hero" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 text-center text-white">
          <div className="animate-fade-in">
            <ChefHat className="h-20 w-20 mx-auto mb-6 drop-shadow-glow" />
            <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
              Chef Fest
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto drop-shadow-md">
              Your AI cooking companion. Discover recipes from ingredients you have, 
              or identify dishes from photos.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/ingredients">
                <Button variant="hero" size="lg" className="w-full sm:w-auto">
                  <Sparkles className="h-5 w-5" />
                  Find Recipes
                </Button>
              </Link>
              <Link to="/photo">
                <Button variant="outline" size="lg" className="w-full sm:w-auto bg-white/10 border-white/30 text-white hover:bg-white/20">
                  <Camera className="h-5 w-5" />
                  Scan Food
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-card p-8 rounded-xl shadow-warm hover:shadow-glow transition-smooth">
              <div className="h-16 w-16 gradient-primary rounded-full flex items-center justify-center mb-4 mx-auto">
                <ChefHat className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Enter Ingredients</h3>
              <p className="text-muted-foreground text-center">
                Type or speak the ingredients you have at home
              </p>
            </div>

            <div className="bg-card p-8 rounded-xl shadow-warm hover:shadow-glow transition-smooth">
              <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center mb-4 mx-auto">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">AI Magic</h3>
              <p className="text-muted-foreground text-center">
                Get personalized recipe suggestions with step-by-step instructions
              </p>
            </div>

            <div className="bg-card p-8 rounded-xl shadow-warm hover:shadow-glow transition-smooth">
              <div className="h-16 w-16 gradient-primary rounded-full flex items-center justify-center mb-4 mx-auto">
                <Camera className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Photo Recognition</h3>
              <p className="text-muted-foreground text-center">
                Snap a photo to identify dishes and get their recipes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 mb-16 md:mb-0">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-lg font-semibold mb-4">Connect With Us</h3>
          <div className="flex justify-center gap-4 mb-4">
            <a 
              href="https://www.instagram.com/itz_calvin7?igsh=NHZpOGZtaDUwNDJw" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-smooth"
            >
              <Instagram className="h-6 w-6" />
            </a>
            <a 
              href="https://x.com/itz_calvin7?t=skowuAFZGnucSdCV-ZKhnA&s=09" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-smooth"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Contact: <a href="mailto:calvinselassie1@gmail.com" className="text-primary hover:underline">
              calvinselassie1@gmail.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
