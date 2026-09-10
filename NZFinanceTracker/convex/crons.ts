import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "remove expenses past the retention window",
  { hours: 6 },
  internal.expenses.cleanupExpired,
  {},
);

crons.interval(
  "clear legacy auto savings entries",
  { hours: 12 },
  internal.savings.reconcileLegacyAutoEntries,
  {},
);

export default crons;
