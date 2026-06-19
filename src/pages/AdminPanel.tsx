import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Shield, BookOpen, Users } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [stats, setStats] = useState({
    totalRecipes: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    const { count: recipesCount } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true });

    const { count: usersCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    setStats({
      totalRecipes: recipesCount || 0,
      totalUsers: usersCount || 0,
    });
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

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen pt-24 pb-8">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Manage recipes, reviews, and users
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 shadow-warm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Total Recipes</h3>
                <p className="text-3xl font-bold text-primary">{stats.totalRecipes}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 shadow-warm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Total Users</h3>
                <p className="text-3xl font-bold text-primary">{stats.totalUsers}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Admin functionality will be added here */}
      </div>
    </div>
  );
};

export default AdminPanel;
