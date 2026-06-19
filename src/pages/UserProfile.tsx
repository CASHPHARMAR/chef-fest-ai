import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const UserProfile = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRecipeCount();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } else {
      setProfile(data);
    }
  };

  const fetchRecipeCount = async () => {
    if (!user) return;
    
    const { count, error } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!error && count !== null) {
      setRecipeCount(count);
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
    return null;
  }

  return (
    <div className="min-h-screen pt-24 pb-8">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">My Profile</h1>
            <p className="text-muted-foreground text-lg">
              Manage your account and preferences
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 shadow-warm text-center">
              <User className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="text-lg font-semibold mb-1">Profile</h3>
              <p className="text-sm text-muted-foreground">Your account</p>
            </Card>
            
            <Card className="p-6 shadow-warm text-center">
              <Mail className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="text-lg font-semibold mb-1">{recipeCount}</h3>
              <p className="text-sm text-muted-foreground">Saved Recipes</p>
            </Card>
            
            {isAdmin && (
              <Card className="p-6 shadow-warm text-center">
                <Shield className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h3 className="text-lg font-semibold mb-1">Admin</h3>
                <p className="text-sm text-muted-foreground">Special Access</p>
              </Card>
            )}
          </div>

          <Card className="p-8 shadow-warm">
            <h2 className="text-2xl font-bold mb-6">Account Information</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || ""}
                  disabled
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="user-id">User ID</Label>
                <Input
                  id="user-id"
                  value={user.id}
                  disabled
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Member Since</Label>
                <Input
                  value={new Date(profile?.created_at || "").toLocaleDateString()}
                  disabled
                  className="mt-1"
                />
              </div>

              {isAdmin && (
                <div className="pt-4">
                  <Button 
                    onClick={() => navigate("/admin")}
                    variant="outline"
                    className="w-full"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Go to Admin Dashboard
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
