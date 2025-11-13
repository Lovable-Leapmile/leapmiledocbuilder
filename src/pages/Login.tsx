import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Login = () => {
  const [password, setPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, user, resetAuth } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Clear any stale auth tokens that can cause infinite refresh attempts
  useEffect(() => {
    if (!user) {
      const hasStale = Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.includes("auth"));
      if (hasStale) {
        resetAuth();
      }
    }
  }, [user, resetAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!mobileNumber || !password) {
      toast.error("Please fill in all fields");
      setLoading(false);
      return;
    }
    
    const { error } = await signIn(mobileNumber, password);
    
    if (error) {
      const isTransient = (error as any)?.status === 503 || /Service Unavailable|network|fetch failed/i.test(error.message);
      toast.error(isTransient ? "The backend is temporarily unavailable. Please try again in a moment." : (error.message || "Login failed. Please check your credentials."));
    } else {
      toast.success("Login successful!");
      navigate("/");
    }
    
    setLoading(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Documentation Builder</CardTitle>
          <CardDescription>Create and manage your technical documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="login-mobile">Mobile Number</Label>
              <Input
                id="login-mobile"
                type="tel"
                placeholder="9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
