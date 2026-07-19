import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { listAdminReviews, moderateReview } from "@/lib/reviews.functions";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  head: () => ({ meta: [{ title: "Admin Reviews — Stevie Services" }] }),
  component: AdminReviews,
});

function AdminReviews() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => listAdminReviews(),
  });
  const mut = useMutation({
    mutationFn: (v: { reviewId: string; isApproved?: boolean; adminResponse?: string | null }) =>
      moderateReview({ data: v }),
    onSuccess: () => {
      toast.success("Review updated");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = data as Array<{
    id: string;
    rating: number;
    comment: string | null;
    is_approved: boolean;
    admin_response: string | null;
    created_at: string;
  }>;

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          No reviews yet.
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1 text-gold">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
                {Array.from({ length: 5 - r.rating }).map((_, i) => (
                  <Star key={`o${i}`} className="h-4 w-4 opacity-30" />
                ))}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-0.5 text-[10px] uppercase tracking-widest ${
                r.is_approved ? "bg-gold/15 text-gold border border-gold/40" : "bg-secondary/60 text-muted-foreground border border-border/60"
              }`}
            >
              {r.is_approved ? "Approved" : "Pending"}
            </span>
          </div>
          {r.comment && (
            <blockquote className="mt-3 whitespace-pre-wrap text-sm">"{r.comment}"</blockquote>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!r.is_approved ? (
              <button
                onClick={() => mut.mutate({ reviewId: r.id, isApproved: true })}
                className="rounded-full bg-gold-gradient px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-foreground shadow-gold-glow"
              >
                Approve
              </button>
            ) : (
              <button
                onClick={() => mut.mutate({ reviewId: r.id, isApproved: false })}
                className="rounded-full border border-border/60 px-4 py-1.5 text-xs uppercase tracking-widest hover:border-gold/40"
              >
                Hide
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
