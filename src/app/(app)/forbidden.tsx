import { PlaceholderPage } from "@/components/shell/placeholder-page";

// Rendered by requireRole() when the User's role lacks access (SPEC §3).
export default function Forbidden() {
  return (
    <PlaceholderPage
      title="No access"
      message="Your role doesn't have access to this page."
      action={{ label: "Go to Dashboard", href: "/" }}
    />
  );
}
