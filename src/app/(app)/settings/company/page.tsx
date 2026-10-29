import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { FormSkeleton } from "@/components/skeletons";
import type { CompanyImageKind } from "@/lib/company-image";
import { PERMISSIONS } from "@/lib/permissions";
import { getCompanySettings } from "@/services/company-settings";
import { DetailsForm, ImageForm } from "./company-forms";

export const metadata: Metadata = { title: "Company settings" };

// Until an Admin uploads one (SPEC §12).
const DEFAULT_LOGO = "/brand/ze-logo-navy.svg";

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CompanySettings />
    </Suspense>
  );
}

// The path changes on every upload, so it also busts the browser cache.
function imageUrl(kind: CompanyImageKind, path: string) {
  return `/settings/company/image/${kind}?v=${encodeURIComponent(path)}`;
}

async function CompanySettings() {
  const actor = await requireRole(...PERMISSIONS.editCompanySettings);
  const settings = await getCompanySettings(actor);

  return (
    <section className="flex max-w-xl flex-col gap-10">
      <p className="text-sm text-ink-muted">
        Printed on every Work Order, Challan and Invoice.
      </p>
      <DetailsForm settings={settings} />
      <ImageForm
        kind="logo"
        title="Logo"
        hint="PNG, JPG or SVG, up to 1 MB."
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        src={
          settings?.logoPath
            ? imageUrl("logo", settings.logoPath)
            : DEFAULT_LOGO
        }
        isDefault={!settings?.logoPath}
      />
      <ImageForm
        kind="signature"
        title="Authorised signature"
        hint="PNG with a transparent background, up to 1 MB."
        accept="image/png,.png"
        src={
          settings?.signaturePath
            ? imageUrl("signature", settings.signaturePath)
            : undefined
        }
      />
    </section>
  );
}
