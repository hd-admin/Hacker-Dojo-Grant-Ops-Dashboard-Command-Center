import type {
  Grant,
  OrganizationProfile,
  CrawlStatus,
  Notification,
  Task,
  ActivityEvent,
} from '../../../shared/types';

// Mock data for E2E testing and standalone browser usage
export const mockGrants: Grant[] = [
  {
    id: 'nsf-techaccess',
    title: 'NSF Technology Access and Adoption Program',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['Science & Tech', 'Federal', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
    fitBreakdown: {
      missionAlignment: 96,
      geographicFocus: 90,
      programTrackrecord: 88,
      budgetCapacity: 82,
      partnershipReadiness: 78,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      {
        label: 'Letter of Intent (3 pages, agent-drafted)',
        done: true,
        source: 'Ready for review',
      },
      { label: 'Project summary & specific aims', done: true, source: 'Drafted' },
      { label: '3 letters of partnership', done: false, source: 'Outreach drafted' },
      { label: 'Logic model + evaluation plan', done: false, source: 'In progress' },
      { label: 'Detailed budget & budget justification', done: false, source: 'Awaits ED input' },
    ],
    draftContent: 'Hacker Dojo proposes to anchor the Silicon Valley AI-Ready Hub...',
    externalUrl: 'https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505734',
  },
  {
    id: 'sv-community-fdn',
    title: 'Silicon Valley Community Foundation Innovation Fund',
    funder: 'Silicon Valley Community Foundation',
    funderShort: 'SVCF',
    award: '$75,000',
    awardSort: 75000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 82,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-20',
    fitBreakdown: {
      missionAlignment: 90,
      geographicFocus: 95,
      programTrackrecord: 85,
      budgetCapacity: 70,
      partnershipReadiness: 75,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Logic model', done: true, source: 'Complete' },
      { label: 'Board roster + bios', done: true, source: 'On file' },
      { label: 'Audit financials', done: false, source: 'Requested from CPA' },
    ],
    draftContent:
      "Hacker Dojo's Innovation Fund proposal focuses on expanding our AI literacy programming...",
  },
  {
    id: 'dell-equality',
    title: 'Dell Technologies Equality Fund',
    funder: 'Dell Technologies Foundation',
    funderShort: 'Dell',
    award: '$150,000',
    awardSort: 150000,
    deadline: '2026-07-01',
    daysOut: 41,
    fit: 76,
    tags: ['Corporate', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-18',
    fitBreakdown: {
      missionAlignment: 85,
      geographicFocus: 80,
      programTrackrecord: 82,
      budgetCapacity: 75,
      partnershipReadiness: 65,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Dell volunteer MOU', done: false, source: 'Pending legal review' },
      { label: 'Impact metrics one-pager', done: true, source: 'Complete' },
    ],
    draftContent:
      "Dell Technologies' commitment to digital equity aligns perfectly with Hacker Dojo's mission...",
  },
  {
    id: 'google-cs-first',
    title: 'Google CS First Expansion Grant',
    funder: 'Google.org',
    funderShort: 'Google',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-06-30',
    daysOut: 40,
    fit: 79,
    tags: ['Science & Tech', 'Corporate', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-17',
    fitBreakdown: {
      missionAlignment: 88,
      geographicFocus: 85,
      programTrackrecord: 80,
      budgetCapacity: 72,
      partnershipReadiness: 70,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Google nonprofit status confirmed', done: true, source: 'Confirmed' },
      { label: 'Teacher recruitment plan', done: false, source: 'Drafting' },
    ],
    draftContent:
      'Google CS First has been a valued partner in our after-school computing program...',
  },
  {
    id: 'kresge-space',
    title: 'Kresge Foundation Learning Spaces Initiative',
    funder: 'Kresge Foundation',
    funderShort: 'Kresge',
    award: '$200,000',
    awardSort: 200000,
    deadline: '2026-08-15',
    daysOut: 86,
    fit: 71,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-15',
    fitBreakdown: {
      missionAlignment: 78,
      geographicFocus: 75,
      programTrackrecord: 72,
      budgetCapacity: 68,
      partnershipReadiness: 62,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Space renovation plans', done: false, source: 'Pending architect' },
      { label: 'Community input documentation', done: true, source: 'Complete' },
    ],
    draftContent:
      "This proposal focuses on transforming Hacker Dojo's main space in Mountain View...",
  },
];

export const mockProfile: OrganizationProfile = {
  legalName: 'Hacker Dojo, a California nonprofit corporation',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  mission:
    'Hacker Dojo is a nonprofit that provides free or low-cost technology education, mentorship, and community infrastructure to underserved youth and adults in the Bay Area.',
  docTypes: ['PDF', 'XLS', 'DOC'],
  searchThemes: [
    'Makerspaces',
    'AI literacy',
    'Community innovation',
    'Workforce development',
    'STEM equity',
  ],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken, evidence-led, builder-community framing.',
  },
};

export const mockCrawlStatus: CrawlStatus = {
  online: true,
  lastSync: new Date().toISOString(),
};

export const mockNotifications: Notification[] = [
  {
    id: '1',
    text: '3 new grants matched from Candid weekly crawl',
    time: '2h ago',
    dot: 'success',
  },
  {
    id: '2',
    text: 'Draft completed for SVCF Community Innovation Fund',
    time: '4h ago',
    dot: 'accent',
  },
  {
    id: '3',
    text: 'Crawled 47 sources - 12 federal, 28 foundation, 7 corporate',
    time: '6h ago',
    dot: 'info',
  },
];

export const mockTasks: Task[] = [
  { id: '1', text: 'Review SVCF LOI submission', completed: false },
  { id: '2', text: 'Follow up on NSF partnership letters', completed: false },
  { id: '3', text: 'Update grant pipeline status', completed: true },
];

export const mockActivity: ActivityEvent[] = [
  {
    dot: 'success',
    text: '<strong>3 new grants</strong> matched from Candid weekly crawl',
    time: '2h ago',
  },
  {
    dot: 'accent',
    text: 'Draft completed for <strong>SVCF Community Innovation Fund</strong> - awaiting review',
    time: '4h ago',
  },
  {
    dot: 'info',
    text: 'Crawled 47 sources - 12 federal, 28 foundation, 7 corporate',
    time: '6h ago',
  },
];

// Type guard to check if electronAPI is available
export function isElectronAPIavailable(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}
