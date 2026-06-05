import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.jpg';

//firebase imports
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isAuthenticated } = useStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let loginEmail = email.trim();

      // Resolve username to email if a matching user document is found in Firestore
      const { query, collection, where, getDocs } = await import("firebase/firestore");
      const usernameQuery = query(
        collection(db, "user"),
        where("username", "==", loginEmail.toLowerCase())
      );
      const usernameSnap = await getDocs(usernameQuery);

      if (!usernameSnap.empty) {
        const userData = usernameSnap.docs[0].data();
        if (userData.email) {
          loginEmail = userData.email;
        }
      }

      const userCred = await signInWithEmailAndPassword(auth, loginEmail, password);
      const uid = userCred.user.uid;
      
      const q = query(collection(db, "user"), where("uid", "==", uid));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("No user record found in database");
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      
      login({
        id: userDoc.id,
        uid: uid,
        name: userData.name || "Admin",
        email: loginEmail,
        role: userData.role || "Admin",
      });

      toast({
        title: "Welcome back!",
        description: `Logged in as ${userData.role || 'Admin'}`,
      });

      navigate("/dashboard");

    } catch (err) {
      console.log(err);
      toast({
        title: "Error",
        description: "Invalid username/email or password",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
      
      <Card className="w-full max-w-md relative z-10 shadow-elevated animate-scale-in">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img src={logo} alt="Techno Bright" className="h-16 w-auto mx-auto" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Techno Bright</CardTitle>
          <CardDescription className="text-muted-foreground italic">
            Art of Blasting Excellence
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Username or Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  placeholder="Username or Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {/* Logic matched to your sample images */}
                  {showPassword ? (
                    <Eye className="h-4 w-4 text-primary" /> 
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In to Dashboard'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}