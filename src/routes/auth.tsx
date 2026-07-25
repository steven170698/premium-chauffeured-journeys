import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, User, Phone, Loader2, Eye, EyeOff } from "lucide-react";
import stevieLogo from "@/assets/logo.png";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/book`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to Stevie Services!");
          router.invalidate();
          navigate({ to: "/book" });
        } else {
          toast.success("Account created! Check your email to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        router.invalidate();
        navigate({ to: "/dashboard" });
      }
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
        <img src={stevieLogo} alt="Stevie Services" className="h-16 w-16 rounded-full object-cover ring-1 ring-gold/40 shadow-gold-glow" />
        <h1 className="mt-6 font-display text-3xl font-semibold text-center">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          {mode === "signin" ? "Sign in to manage your rides" : "Book faster and track every trip"}
        </p>

        <div className="mt-8 w-full rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur">
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
  // Password fields get an eye toggle so people can check what they typed.
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30 transition-colors">
      <span className="text-muted-foreground">{icon}</span>
      <input
        type={isPassword && revealed ? "text" : type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Hide password" : "Show password"}
          title={revealed ? "Hide password" : "Show password"}
          className="shrink-0 text-muted-foreground transition-colors hover:text-gold"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </label>
  );
}
