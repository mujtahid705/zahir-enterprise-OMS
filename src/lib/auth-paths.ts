// Routes a signed-out visitor may open. Everything else redirects to /login.
// /reset-password is not here: it needs the session the reset link creates.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/confirm"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

const SAME_ORIGIN = "http://same.invalid";

// Where to go after an emailed link. Only same-site paths, so the link can't
// be turned into an open redirect. Parses the way the redirect will (which
// drops tabs and newlines), then requires it to stay on our origin.
export function safeNextPath(next: string | null): string {
  if (!next?.startsWith("/")) return "/";
  const url = new URL(next, SAME_ORIGIN);
  if (url.origin !== SAME_ORIGIN || url.pathname.startsWith("//")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
