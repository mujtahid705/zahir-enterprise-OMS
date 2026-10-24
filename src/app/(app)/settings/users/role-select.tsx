import type { ComponentProps } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { ROLES, ROLE_LABEL } from "@/lib/permissions";

export function RoleSelect(props: ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect {...props}>
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABEL[role]}
        </option>
      ))}
    </NativeSelect>
  );
}
