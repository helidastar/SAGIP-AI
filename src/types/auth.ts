export type Role = "responder" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  team_id: string | null;
}
