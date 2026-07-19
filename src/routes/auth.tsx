import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Mail, Lock, User, Phone, Loader2 } from "lucide-react";
import stevieLogo from "@/assets/stevie-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Stevie Services LLC" },
      { name: "description", content: "Sign in or create an account to book and manage your Stevie Services rides." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    router.invalidate();
    navigate({ to: "/dashboard" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      router.invalidate();
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[80vh]">
      <div className="absolute inset-0 -z-10 bg-radial-gold" />
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
        <img src={stevieLogo.url} alt="Stevie Services" className="h-16 w-16 rounded-full ring-1 ring-gold/40 shadow-gold-glow" />
        <h1 className="mt-6 font-display text-3xl font-semibold text-center">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          {mode === "signin" ? "Sign in to manage your rides" : "Book faster and track every trip"}
        </p>

        <div className="mt-8 w-full rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <IconInput icon={<User className="h-4 w-4" />} placeholder="Full name" value={fullName} onChange={setFullName} required />
                <IconInput icon={<Phone className="h-4 w-4" />} placeholder="Phone number" value={phone} onChange={setPhone} type="tel" required />
              </>
            )}
            <IconInput icon={<Mail className="h-4 w-4" />} placeholder="Email address" value={email} onChange={setEmail} type="email" required />
            <IconInput icon={<Lock className="h-4 w-4" />} placeholder="Password" value={password} onChange={setPassword} type="password" required />
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-gold hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>

        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function IconInput({
  icon, placeholder, value, onChange, type = "text", required,
}: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30 transition-colors">
      <span className="text-muted-foreground">{icon}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
    </label>
  );
}
