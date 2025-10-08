import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";
import Navigation from "@/components/Navigation";

const AdminPanel = () => {
  // TODO: Implement authentication check
  const isAdmin = false;

  if (!isAdmin) {
    return (
      <div className="min-h-screen pb-20 md:pt-20">
        <Navigation />
        
        <div className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center shadow-warm max-w-2xl mx-auto">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You need admin privileges to access this page.
            </p>
          </Card>
        </div>
      </div>
    );
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
