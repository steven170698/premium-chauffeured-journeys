/**
 * Client-side error reporting for the root error boundary.
 *
 * Replaces the old Lovable reporter, which only forwarded to globals injected
 * by the Lovable editor preview (`window.__lovableEvents` /
 * `__lovableReportRuntimeError`) and was therefore a no-op on the live site.
 */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  // Loaders and server fns commonly throw a raw Response; String(it) gives the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  console.error("[app error]", message, {
    route: window.location.pathname,
    ...context,
    stack: error instanceof Error ? error.stack : undefined,
  });
}
