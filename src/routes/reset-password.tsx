import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import stevieLogo from "@/assets/logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Stevie Services LLC" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  // null = still checking. Supabase turns the recovery token in the URL into a
  // session on load, so a valid link means we have one.
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        setHasRecoverySession(true);
        return;
      }
      // The token is parsed asynchronously; listen briefly before giving up.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!cancelled && session) setHasRecoverySession(true);
      });
      setTimeout(() => {
        if (!cancelled) setHasRecoverySession((v) => (v === null ? false : v));
        sub.subscription.unsubscribe();
      }, 3000);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Those passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you're signed in.");
      router.invalidate();
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Could not update your password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[80vh]">
      <div className="absolute inset-0 -z-10 bg-radial-gold" />
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
        <img
          src={stevieLogo}
          alt="Stevie Services"
          className="h-16 w-16 rounded-full object-cover ring-1 ring-gold/40 shadow-gold-glow"
        />
        <h1 className="mt-6 font-display text-3xl font-semibold text-center">
          Choose a new password
        </h1>

        {hasRecoverySession === null && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your reset link…
          </p>
        )}

        {hasRecoverySession === false && (
          <div className="mt-8 w-full rounded-3xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in
              page — links are single-use and time-limited.
            </p>
            <Link
              to="/auth"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {hasRecoverySession === true && (
          <>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              Pick something you'll remember — you'll be signed in straight away.
            </p>
            <div className="mt-8 w-full rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur">
              <form onSubmit={handleSubmit} className="space-y-3">
                <PasswordField
                  placeholder="New password"
                  value={password}
                  onChange={setPassword}
                  revealed={revealed}
                  onToggle={() => setRevealed((v) => !v)}
                />
                <PasswordField
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={setConfirm}
                  revealed={revealed}
                  onToggle={() => setRevealed((v) => !v)}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update password
                </button>
              </form>
            </div>
          </>
        )}

        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function PasswordField({
  placeholder,
  value,
  onChange,
  revealed,
  onToggle,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30 transition-colors">
      <span className="text-muted-foreground">
        <Lock className="h-4 w-4" />
      </span>
      <input
        type={revealed ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={revealed ? "Hide password" : "Show password"}
        title={revealed ? "Hide password" : "Show password"}
        className="shrink-0 text-muted-foreground transition-colors hover:text-gold"
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </label>
  );
}
