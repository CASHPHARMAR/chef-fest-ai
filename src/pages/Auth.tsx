import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, AlertCircle } from "lucide-react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Navigation from "@/components/Navigation";
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const redirectParam = searchParams.get("redirect");
  const modeParam = searchParams.get("mode");
  const [activeTab, setActiveTab] = useState(modeParam === "signup" ? "signup" : "login");
  
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  
  const [loginEmailError, setLoginEmailError] = useState("");
  const [loginPasswordError, setLoginPasswordError] = useState("");
  const [signupEmailError, setSignupEmailError] = useState("");
  const [signupPasswordError, setSignupPasswordError] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginEmailError("");
    setLoginPasswordError("");
    
    // Validate
    const emailValidation = emailSchema.safeParse(loginEmail);
    const passwordValidation = passwordSchema.safeParse(loginPassword);
    
    if (!emailValidation.success) {
      setLoginEmailError(emailValidation.error.errors[0].message);
      return;
    }
    
    if (!passwordValidation.success) {
      setLoginPasswordError(passwordValidation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    await signIn(loginEmail, loginPassword);
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupEmailError("");
    setSignupPasswordError("");
    
    // Validate
    const emailValidation = emailSchema.safeParse(signupEmail);
    const passwordValidation = passwordSchema.safeParse(signupPassword);
    
    if (!emailValidation.success) {
      setSignupEmailError(emailValidation.error.errors[0].message);
      return;
    }
    
    if (!passwordValidation.success) {
      setSignupPasswordError(passwordValidation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    await signUp(signupEmail, signupPassword);
    setIsLoading(false);
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen flex items-center justify-center px-4 py-12 pt-20 pb-24 md:pb-12">
        <Card className="w-full max-w-md p-8 shadow-warm animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <ChefHat className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold">Chef Fest</h1>
          <p className="text-muted-foreground mt-2">
            {redirectParam ? "Sign in to continue" : "Sign in to your account"}
          </p>
        </div>

        {redirectParam && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              Please sign in to access this page
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
                {loginEmailError && (
                  <p className="text-sm text-destructive">{loginEmailError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                {loginPasswordError && (
                  <p className="text-sm text-destructive">{loginPasswordError}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
                {signupEmailError && (
                  <p className="text-sm text-destructive">{signupEmailError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
                {signupPasswordError && (
                  <p className="text-sm text-destructive">{signupPasswordError}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
      </div>
    </>
  );
};

export default Auth;
