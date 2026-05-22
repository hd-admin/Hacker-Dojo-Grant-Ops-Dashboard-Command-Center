import { z } from 'zod';

// Grant status - GAP-02 FIX: 'discarded' is NOT a valid status
export const GrantStatusSchema = z.enum(['matched', 'draft', 'review', 'submitted', 'awarded']);

export const FitScoreBreakdownSchema = z.object({
  missionAlignment: z.number().min(0).max(100),
  geographicFocus: z.number().min(0).max(100),
  programTrackrecord: z.number().min(0).max(100),
  budgetCapacity: z.number().min(0).max(100),
  partnershipReadiness: z.number().min(0).max(100),
});

export const ChecklistItemSchema = z.object({
  label: z.string(),
  done: z.boolean(),
  source: z.string(),
});

export const GrantSchema = z.object({
  id: z.string(),
  title: z.string(),
  funder: z.string(),
  funderShort: z.string(),
  award: z.string(),
  awardSort: z.number(),
  deadline: z.string(),
  daysOut: z.number(),
  fit: z.number(),
  tags: z.array(z.string()),
  status: GrantStatusSchema,
  statusLabel: z.string(),
  matchedAt: z.string().optional(),
  fitBreakdown: FitScoreBreakdownSchema.optional(),
  checklist: z.array(ChecklistItemSchema).optional(),
  draftContent: z.string().optional(),
  externalUrl: z.string().optional(),
});

export const OrganizationProfileSchema = z.object({
  legalName: z.string(),
  ein: z.string(),
  samUEI: z.string(),
  mission: z.string(),
  docTypes: z.array(z.string()),
  searchThemes: z.array(z.string()),
  agentBehavior: z.object({
    autoDraftThreshold: z.number(),
    submissionPolicy: z.string(),
    notifyEmail: z.string(),
    voiceAndTone: z.string(),
  }),
});

export const ActivityEventSchema = z.object({
  dot: z.string(),
  text: z.string(),
  time: z.string(),
});

export const CrawlStatusSchema = z.object({
  online: z.boolean(),
  lastSync: z.string(),
});

export const NotificationSchema = z.object({
  id: z.string(),
  text: z.string(),
  time: z.string(),
  dot: z.string(),
});

export const TaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
});

export const DocumentMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  lastUsed: z.string().optional(),
  version: z.string().optional(),
  audited: z.boolean().optional(),
});

export type Grant = z.infer<typeof GrantSchema>;
export type OrganizationProfile = z.infer<typeof OrganizationProfileSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type FitScoreBreakdown = z.infer<typeof FitScoreBreakdownSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
