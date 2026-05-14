// Mobile is locked to مركز سواء as a single organization. Keep this component
// as a no-op compatibility shim so old imports cannot trigger membership or
// switch-organization network calls.
export function OrganizationSwitcherSection() {
  return null;
}
