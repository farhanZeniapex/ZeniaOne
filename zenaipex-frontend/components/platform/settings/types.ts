export type DashboardMode = "admin" | "company";

export interface SharedSettingsProps {
  mode: DashboardMode;
  companyId?: string; // required for company mode
}
