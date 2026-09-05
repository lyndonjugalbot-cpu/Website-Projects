import type { Doc } from "../convex/_generated/dataModel";

export type UserDoc = Doc<"users">;
export type CoachingLogDoc = Doc<"coachingLogs"> & { recordingUrl: string | null };
export type MetricDoc = Doc<"metrics">;
