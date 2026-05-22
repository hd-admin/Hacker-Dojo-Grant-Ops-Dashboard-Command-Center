'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ActivityEventSchema =
  exports.OrganizationProfileSchema =
  exports.GrantSchema =
  exports.ChecklistItemSchema =
  exports.FitScoreBreakdownSchema =
  exports.GrantStatusSchema =
    void 0;
const zod_1 = require('zod');
// Grant status - GAP-02 FIX: 'discarded' is NOT a valid status
exports.GrantStatusSchema = zod_1.z.enum(['matched', 'draft', 'review', 'submitted', 'awarded']);
exports.FitScoreBreakdownSchema = zod_1.z.object({
  missionAlignment: zod_1.z.number().min(0).max(100),
  geographicFocus: zod_1.z.number().min(0).max(100),
  programTrackrecord: zod_1.z.number().min(0).max(100),
  budgetCapacity: zod_1.z.number().min(0).max(100),
  partnershipReadiness: zod_1.z.number().min(0).max(100),
});
exports.ChecklistItemSchema = zod_1.z.object({
  label: zod_1.z.string(),
  done: zod_1.z.boolean(),
  source: zod_1.z.string(),
});
exports.GrantSchema = zod_1.z.object({
  id: zod_1.z.string(),
  title: zod_1.z.string(),
  funder: zod_1.z.string(),
  funderShort: zod_1.z.string(),
  award: zod_1.z.string(),
  awardSort: zod_1.z.number(),
  deadline: zod_1.z.string(),
  daysOut: zod_1.z.number(),
  fit: zod_1.z.number(),
  tags: zod_1.z.array(zod_1.z.string()),
  status: exports.GrantStatusSchema,
  statusLabel: zod_1.z.string(),
  matchedAt: zod_1.z.string().optional(),
  fitBreakdown: exports.FitScoreBreakdownSchema.optional(),
  checklist: zod_1.z.array(exports.ChecklistItemSchema).optional(),
  draftContent: zod_1.z.string().optional(),
  externalUrl: zod_1.z.string().optional(),
});
exports.OrganizationProfileSchema = zod_1.z.object({
  legalName: zod_1.z.string(),
  ein: zod_1.z.string(),
  samUEI: zod_1.z.string(),
  mission: zod_1.z.string(),
  docTypes: zod_1.z.array(zod_1.z.string()),
  searchThemes: zod_1.z.array(zod_1.z.string()),
  agentBehavior: zod_1.z.object({
    autoDraftThreshold: zod_1.z.number(),
    submissionPolicy: zod_1.z.string(),
    notifyEmail: zod_1.z.string(),
    voiceAndTone: zod_1.z.string(),
  }),
});
exports.ActivityEventSchema = zod_1.z.object({
  dot: zod_1.z.string(),
  text: zod_1.z.string(),
  time: zod_1.z.string(),
});
