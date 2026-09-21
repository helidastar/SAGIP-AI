import { withStaff } from "@/lib/auth";

export const GET = withStaff(async (_request, _ctx, staff) => Response.json(staff));
