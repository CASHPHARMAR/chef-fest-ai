import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAdmin) {
      // Redirect non-admin users to home
      navigate("/");
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen pb-20 md:pt-20">
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
    <div className="min-h-screen pb-20 md:pt-20">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Manage recipes, reviews, and users
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 shadow-warm">
            <h3 className="text-lg font-semibold mb-2">Total Recipes</h3>
            <p className="text-3xl font-bold text-primary">0</p>
          </Card>
          
          <Card className="p-6 shadow-warm">
            <h3 className="text-lg font-semibold mb-2">Total Users</h3>
            <p className="text-3xl font-bold text-primary">0</p>
          </Card>
          
          <Card className="p-6 shadow-warm">
            <h3 className="text-lg font-semibold mb-2">Reviews</h3>
            <p className="text-3xl font-bold text-primary">0</p>
          </Card>
        </div>

        {/* Admin functionality will be added here */}
      </div>
    </div>
  );
};

export default AdminPanel;
