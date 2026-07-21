import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, LayoutDashboard } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import stevieLogo from "@/assets/logo.png";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-gold">Stevie Services</p>
        <h1 className="mt-4 font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Route not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for has taken a detour.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground transition-transform hover:-translate-y-0.5 shadow-gold-glow"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Something went off route
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again or head back home. If it keeps happening, call us at 929-299-9747.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-secondary px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Stevie Services LLC — Luxury Chauffeur & Private Transportation" },
      {
        name: "description",
        content:
          "Professional, reliable, comfortable chauffeur service in New York and New Jersey. Airport, business, event, and long-distance transportation. Book instantly online.",
      },
      { name: "author", content: "Stevie Services LLC" },
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:title", content: "Stevie Services LLC — Luxury Chauffeur Service" },
      {
        property: "og:description",
        content: "Professional • Reliable • Comfortable Transportation. Book online in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: stevieLogo },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={stevieLogo}
            alt="Stevie Services LLC"
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-gold/40 shadow-gold-glow"
          />
          <div className="leading-tight">
            <div className="font-display text-base font-semibold tracking-tight">Stevie Services</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Private Chauffeur</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
          <Link to="/book" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Book</Link>
          <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
          <a href="tel:9292999747" className="text-sm text-muted-foreground hover:text-foreground transition-colors">929-299-9747</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/dashboard" className="hidden md:inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold hover:bg-muted">
                <LayoutDashboard className="h-3 w-3" /> Dashboard
              </Link>
              <button onClick={handleSignOut} title="Sign out" className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-muted">
                <LogOut className="h-3 w-3" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="hidden md:inline-flex rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold hover:bg-muted">
              Sign in
            </Link>
          )}
          <Link
            to="/book"
            className="inline-flex items-center justify-center rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-gold-foreground transition-transform hover:-translate-y-0.5 shadow-gold-glow"
          >
            Book a Ride
          </Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img src={stevieLogo} alt="Stevie Services LLC" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-gold/40" />
              <div className="font-display text-lg font-semibold">Stevie Services LLC</div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Professional, reliable, and comfortable private transportation across New York, New Jersey, and beyond.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-gold">Contact</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><a href="tel:9292999747" className="hover:text-foreground">929-299-9747</a></li>
              <li><a href="https://StevieServicesLLC.com" className="hover:text-foreground">StevieServicesLLC.com</a></li>
              <li>New York, NY & New Jersey · America/New_York</li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-gold">Explore</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Home</Link></li>
              <li><Link to="/services" className="hover:text-foreground">Services</Link></li>
              <li><Link to="/services/airport" className="hover:text-foreground">Airport Transportation</Link></li>
              <li><Link to="/services/hourly" className="hover:text-foreground">Hourly Chauffeur</Link></li>
              <li><Link to="/about" className="hover:text-foreground">About</Link></li>
              <li><Link to="/faq" className="hover:text-foreground">FAQ</Link></li>
              <li><Link to="/book" className="hover:text-foreground">Book a Ride</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
          <Link to="/cancellation-policy" className="hover:text-foreground">Cancellation & Refund Policy</Link>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} Stevie Services LLC. All rights reserved.</div>
          <div>Licensed · Insured · Available 24/7</div>
        </div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader user={user} />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
        <Toaster theme="dark" position="top-right" richColors />
      </div>
    </QueryClientProvider>
  );
}
