import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { Grant, GrantStatus, OrganizationProfile, ActivityEvent } from '../shared/types';

interface CrawlStatus {
  online: boolean;
  lastSync: string;
}

interface Notification {
  id: string;
  text: string;
  time: string;
  dot: string;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

interface DocumentMetadata {
  id: string;
  name: string;
  type: string;
  lastUsed?: string;
  version?: string;
  audited?: boolean;
}

interface StoreData {
  grants: Grant[];
  profile: OrganizationProfile;
  crawlStatus: CrawlStatus;
  notifications: Notification[];
  tasks: Task[];
  documents: DocumentMetadata[];
  activity: ActivityEvent[];
}

// GAP-06 FIX: matchedAt dates relative to TODAY constant
const TODAY = '2026-05-21';

const defaultProfile: OrganizationProfile = {
  legalName: 'Hacker Dojo, a California nonprofit corporation',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  mission:
    'Hacker Dojo is a nonprofit that provides free or low-cost technology education, mentorship, and community infrastructure to underserved youth and adults in the Bay Area. We believe talent is evenly distributed, but opportunity is not.',
  docTypes: ['PDF', 'XLS', 'DOC'],
  searchThemes: [
    'Makerspaces',
    'AI literacy',
    'Community innovation',
    'Workforce development',
    'STEM equity',
    'Digital inclusion',
    'Informal STEM',
    'Bay Area/Silicon Valley',
  ],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone:
      'Plain-spoken, evidence-led, builder-community framing. Avoid jargon. Lead with outcomes.',
  },
};

const seedGrants: Grant[] = [
  // 6 grants with matchedAt within last 7 days (for New Matches 7d KPI)
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
      {
        label: '3 letters of partnership (Mountain View Library, Foothill, Code2College)',
        done: false,
        source: 'Outreach drafted',
      },
      { label: 'Logic model + evaluation plan', done: false, source: 'In progress' },
      {
        label: 'Detailed budget & budget justification',
        done: false,
        source: 'Awaits ED input',
      },
    ],
    draftContent: `Hacker Dojo proposes to anchor the Silicon Valley AI-Ready Hub, a regional coordination node convening makerspaces, public libraries, community colleges, and grassroots educators across San Mateo, Santa Clara, and Alameda counties.

The Hub will address a critical gap: while AI is transforming every industry, the communities most likely to be left behind—the same communities Hacker Dojo has served since 2011—lack structured pathways to AI literacy and related workforce opportunities. The Hub will create a distributed but coordinated network that leverages existing infrastructure and trusted relationships to deliver AI-readiness programming at scale.

**Program Components**
1. AI Fundamentals Cohort Series: 12-week hands-on cohorts for adults 18+, with emphasis on participants from low-income households and underrepresented minorities.
2. Youth AI Explorer Camps: Summer and after-school programs for middle and high school students, co-designed with local school districts.
3. Community Champion Training: Train-the-trainer program for librarians, community center staff, and peer educators.
4. Employer Connection Initiative: Structured internships, job shadows, and mentorship connections with Silicon Valley tech employers.

**Evaluation**
We will use a mixed-methods approach tracking: (1) program completion rates, (2) pre/post AI knowledge assessments, (3) 6-month employment/education outcomes for adult participants, and (4) participant satisfaction and sense of agency surveys.

**Organizational Qualifications**
Hacker Dojo brings 14 years of nonprofit tech education experience, established relationships with 23 partner organizations across the Bay Area, and a track record of serving over 45,000 learners since our founding. Our executive director and board chair have prior NSF-funded project experience.`,
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
    draftContent: `Hacker Dojo's Innovation Fund proposal focuses on expanding our AI literacy programming to reach 500 additional Bay Area residents over 18 months.

Our model is simple but effective: we meet learners where they are—in libraries, community centers, and partner organization sites—rather than requiring them to come to us. This approach has allowed us to consistently reach populations that traditional tech training programs miss: older adults, non-English speakers, and people whose work schedules preclude formal classroom attendance.

With SVCF's support, we will: (1) launch 8 new community site partnerships, (2) develop culturally responsive AI curriculum in Spanish and Mandarin, and (3) train 24 community educators to deliver programming independently.`,
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
    draftContent: `Dell Technologies' commitment to digital equity aligns perfectly with Hacker Dojo's mission to democratize technology access. This proposal seeks funding to scale our workforce development programming, specifically targeting opportunity youth ages 16-24 in East San Jose and Oakland—two communities with persistently high unemployment and limited access to tech career pathways.

Our 12-week intensive program combines technical skills (Python, data analysis, cloud fundamentals) with professional development and direct employer connections. Graduates receive job placement support for 12 months post-completion.`,
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
    draftContent: `Google CS First has been a valued partner in our after-school computing program. This proposal requests expansion funding to bring CS First curriculum to 15 additional Title I schools across Santa Clara County over the next two academic years.

The grant will support: (1) curriculum licensing for 1,200 students, (2) training for 30 volunteer teachers and aides, and (3) equipment stipends for schools without existing computing infrastructure.`,
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
    draftContent: `This proposal focuses on transforming Hacker Dojo's main space in Mountain View into a more welcoming and functional learning environment for our community programs.

The Learning Spaces Initiative grant would fund: (1) modular furniture that can be reconfigured for different program formats, (2) improved acoustics and lighting for virtual/hybrid programming, and (3) a dedicated quiet study area for adult learners.`,
  },
  {
    id: 'wwf-stem-equity',
    title: 'World Wildlife Fund STEM Equity Initiative',
    funder: 'World Wildlife Fund',
    funderShort: 'WWF',
    award: '$125,000',
    awardSort: 125000,
    deadline: '2026-07-15',
    daysOut: 55,
    fit: 68,
    tags: ['Science & Tech', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-16',
    fitBreakdown: {
      missionAlignment: 72,
      geographicFocus: 65,
      programTrackrecord: 70,
      budgetCapacity: 75,
      partnershipReadiness: 58,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Environmental focus integration plan', done: false, source: 'In progress' },
    ],
    draftContent: `While WWF is known for conservation, this initiative recognizes that environmental justice and technology access are deeply intertwined. Communities without digital literacy cannot fully participate in environmental monitoring, climate policy advocacy, or green economy careers.

This proposal pairs Hacker Dojo's tech education expertise with WWF's environmental programming to create a "Tech for Nature" track for youth ages 12-18. Participants will learn data collection, mapping, and analysis skills while contributing to real citizen science projects.`,
  },
  // Drafting status grants
  {
    id: 'morrell-fdn',
    title: 'Morrell Family Foundation General Support',
    funder: 'Morrell Family Foundation',
    funderShort: 'Morrell',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-06-01',
    daysOut: 11,
    fit: 84,
    tags: ['Community', 'Foundation'],
    status: 'draft',
    statusLabel: 'Drafting',
    matchedAt: '2026-05-10',
    fitBreakdown: {
      missionAlignment: 88,
      geographicFocus: 82,
      programTrackrecord: 85,
      budgetCapacity: 80,
      partnershipReadiness: 72,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'LOI submission', done: true, source: 'May 1' },
      { label: 'Full proposal draft', done: false, source: 'In progress' },
      { label: 'Board chair signature', done: false, source: 'Pending' },
    ],
    draftContent: `The Morrell Family Foundation has long supported grassroots community organizations in the Bay Area. Hacker Dojo has benefited from Morrell grants in the past, and we are grateful for this opportunity to seek continued general operating support.

This proposal requests $50,000 in unrestricted funding to support our core programs, including staff salaries, facility costs, and curriculum development.`,
  },
  {
    id: 'stanford-recovery',
    title: 'Stanford Recovery Act Community Grants',
    funder: 'Stanford University',
    funderShort: 'Stanford',
    award: '$60,000',
    awardSort: 60000,
    deadline: '2026-06-20',
    daysOut: 30,
    fit: 77,
    tags: ['Science & Tech', 'Federal'],
    status: 'draft',
    statusLabel: 'Drafting',
    matchedAt: '2026-05-08',
    fitBreakdown: {
      missionAlignment: 80,
      geographicFocus: 85,
      programTrackrecord: 78,
      budgetCapacity: 72,
      partnershipReadiness: 70,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Stanford partner letter', done: false, source: 'Requested' },
      { label: 'Proposal narrative', done: false, source: 'Drafting' },
    ],
    draftContent: `Stanford's Community Grants program supports organizations advancing economic recovery in underserved Bay Area communities. Hacker Dojo proposes to expand our workforce development programming to serve an additional 200 participants annually, with a focus on individuals affected by recent tech layoffs in the South Bay.`,
  },
  // Review status grants
  {
    id: 'horizon-ed',
    title: 'Horizon Education Grants',
    funder: 'Horizon Therapeutics',
    funderShort: 'Horizon',
    award: '$90,000',
    awardSort: 90000,
    deadline: '2026-06-10',
    daysOut: 20,
    fit: 81,
    tags: ['EdTech', 'Corporate'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-05',
    fitBreakdown: {
      missionAlignment: 85,
      geographicFocus: 78,
      programTrackrecord: 82,
      budgetCapacity: 79,
      partnershipReadiness: 74,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Full proposal', done: true, source: 'Complete' },
      { label: 'Budget narrative', done: true, source: 'Complete' },
      { label: 'Logic model', done: true, source: 'Complete' },
      { label: 'Organizational chart', done: true, source: 'On file' },
      { label: 'Staff bios', done: true, source: 'On file' },
      { label: 'ED review', done: false, source: 'Scheduled May 22' },
    ],
    draftContent: `Horizon Education Grants support innovative approaches to STEM education that reach underrepresented populations. This proposal requests $90,000 to develop and pilot a "AI for Social Good" curriculum for high school students in partnership with three East Side Union High School District schools.

The 8-week program will cover: introduction to machine learning concepts, ethical considerations in AI, and a capstone project where students use AI tools to address a community problem of their choosing.`,
  },
  {
    id: 'mellon-humanities',
    title: 'Mellon Foundation Humanities & Justice Grants',
    funder: 'Andrew W. Mellon Foundation',
    funderShort: 'Mellon',
    award: '$175,000',
    awardSort: 175000,
    deadline: '2026-07-30',
    daysOut: 70,
    fit: 73,
    tags: ['Community', 'Foundation'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-01',
    fitBreakdown: {
      missionAlignment: 78,
      geographicFocus: 72,
      programTrackrecord: 75,
      budgetCapacity: 70,
      partnershipReadiness: 68,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Humanities focus integration', done: true, source: 'Complete' },
      { label: 'Community partner letters', done: false, source: 'Awaiting response' },
    ],
    draftContent: `The Mellon Foundation's Humanities & Justice program aligns with our belief that technology education must be grounded in social context. This proposal develops a "Tech & Identity" program exploring the relationship between technology, culture, and community history.

Topics include: the role of technology in immigration and diaspora communities, digital preservation of cultural heritage, and technology's impact on labor and economic justice.`,
  },
  // Submitted status grants
  {
    id: 'fcc-digital',
    title: 'FCC Digital Equity Act Grants',
    funder: 'Federal Communications Commission',
    funderShort: 'FCC',
    award: '$250,000',
    awardSort: 250000,
    deadline: '2026-05-15',
    daysOut: -6,
    fit: 86,
    tags: ['Federal', 'Community'],
    status: 'submitted',
    statusLabel: 'Submitted',
    matchedAt: '2026-04-20',
    fitBreakdown: {
      missionAlignment: 92,
      geographicFocus: 88,
      programTrackrecord: 85,
      budgetCapacity: 80,
      partnershipReadiness: 82,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Full proposal submitted', done: true, source: 'May 10' },
      { label: 'Budget narrative', done: true, source: 'Complete' },
      { label: 'Letters of support (7)', done: true, source: 'All received' },
    ],
    draftContent: `The FCC Digital Equity Act aims to ensure all Americans can fully participate in the digital economy. Hacker Dojo's proposal addresses digital equity in the Bay Area by: (1) providing devices and broadband access to 500 households, (2) delivering digital literacy training to 1,200 individuals, and (3) establishing 8 community digital navigators to provide ongoing support.`,
    externalUrl: 'https://www.fcc.gov/document/fcc-announces-digital-equity-act-grant-program',
  },
  {
    id: 'silicon-valley-campaign',
    title: 'Silicon Valley Community Campaign',
    funder: 'United Way Silicon Valley',
    funderShort: 'United Way',
    award: '$40,000',
    awardSort: 40000,
    deadline: '2026-05-01',
    daysOut: -20,
    fit: 79,
    tags: ['Community', 'Foundation'],
    status: 'submitted',
    statusLabel: 'Submitted',
    matchedAt: '2026-03-15',
    fitBreakdown: {
      missionAlignment: 84,
      geographicFocus: 90,
      programTrackrecord: 82,
      budgetCapacity: 68,
      partnershipReadiness: 72,
    },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Proposal submitted', done: true, source: 'Apr 28' },
    ],
    draftContent: `United Way's Community Campaign supports direct service organizations addressing immediate community needs. Hacker Dojo's proposal focuses on digital literacy programming for seniors and immigrants—populations often left behind in the digital transition.`,
  },
  // Awarded/Closed historical grant
  {
    id: 'dea-just说',
    title: 'DEA Youth Prevention Grants (Closed)',
    funder: 'Drug Enforcement Administration',
    funderShort: 'DEA',
    award: '$30,000',
    awardSort: 30000,
    deadline: '2025-12-01',
    daysOut: -171,
    fit: 45,
    tags: ['Federal', 'Community'],
    status: 'awarded',
    statusLabel: 'Awarded',
    matchedAt: '2025-09-01',
    fitBreakdown: {
      missionAlignment: 50,
      geographicFocus: 55,
      programTrackrecord: 45,
      budgetCapacity: 40,
      partnershipReadiness: 35,
    },
    checklist: [
      { label: 'Project completed', done: true, source: 'Dec 2025' },
      { label: 'Final report submitted', done: true, source: 'Jan 2026' },
    ],
    draftContent: `This was a historical grant focused on substance abuse prevention education in coordination with local schools. The program was completed successfully in December 2025.`,
  },
  // Additional EdTech grants (EdTech: 4 -> 11)
  {
    id: 'att-fiber-edu',
    title: 'AT&T Fiber Education Initiative',
    funder: 'AT&T',
    funderShort: 'AT&T',
    award: '$120,000',
    awardSort: 120000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 77,
    tags: ['EdTech', 'Corporate'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
    fitBreakdown: { missionAlignment: 82, geographicFocus: 78, programTrackrecord: 80, budgetCapacity: 72, partnershipReadiness: 70 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Digital inclusion plan', done: false, source: 'Drafting' },
    ],
    draftContent: `AT&T's Fiber Education Initiative supports organizations expanding broadband access and digital literacy in underserved communities.`,
  },
  {
    id: 'intuit-reboot',
    title: 'Intuit Reboot Career Readiness',
    funder: 'Intuit Foundation',
    funderShort: 'Intuit',
    award: '$85,000',
    awardSort: 85000,
    deadline: '2026-07-15',
    daysOut: 55,
    fit: 80,
    tags: ['EdTech', 'Corporate'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-18',
    fitBreakdown: { missionAlignment: 85, geographicFocus: 82, programTrackrecord: 78, budgetCapacity: 75, partnershipReadiness: 72 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'QuickBooks training integration plan', done: false, source: 'In progress' },
    ],
    draftContent: `Intuit's Reboot Career Readiness program supports workforce development organizations teaching financial and business technology skills.`,
  },
  {
    id: 'salesforce-nonprofit',
    title: 'Salesforce Nonprofit Cloud Grants',
    funder: 'Salesforce.org',
    funderShort: 'Salesforce',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-06-01',
    daysOut: 11,
    fit: 73,
    tags: ['EdTech', 'Corporate'],
    status: 'draft',
    statusLabel: 'Drafting',
    matchedAt: '2026-05-15',
    fitBreakdown: { missionAlignment: 78, geographicFocus: 75, programTrackrecord: 72, budgetCapacity: 70, partnershipReadiness: 68 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'CRM implementation plan', done: false, source: 'Drafting' },
    ],
    draftContent: `Salesforce Nonprofit Cloud grants support organizations implementing CRM systems to improve program delivery and donor management.`,
  },
  {
    id: 'adobe-creative',
    title: 'Adobe Creative Residency Community',
    funder: 'Adobe Foundation',
    funderShort: 'Adobe',
    award: '$65,000',
    awardSort: 65000,
    deadline: '2026-08-01',
    daysOut: 72,
    fit: 75,
    tags: ['EdTech', 'Corporate'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-14',
    fitBreakdown: { missionAlignment: 80, geographicFocus: 72, programTrackrecord: 76, budgetCapacity: 74, partnershipReadiness: 68 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Creative tool curriculum', done: false, source: 'Planning' },
    ],
    draftContent: `Adobe's Creative Residency Community grants support organizations using creative technology for social impact.`,
  },
  {
    id: 'hp-foundation',
    title: 'HP Foundation Technology Access',
    funder: 'HP Foundation',
    funderShort: 'HP',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-07-30',
    daysOut: 70,
    fit: 78,
    tags: ['EdTech', 'Corporate'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-10',
    fitBreakdown: { missionAlignment: 82, geographicFocus: 80, programTrackrecord: 78, budgetCapacity: 74, partnershipReadiness: 70 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Equipment proposal', done: true, source: 'Complete' },
      { label: 'ED review', done: false, source: 'Scheduled May 28' },
    ],
    draftContent: `HP Foundation's Technology Access program supports organizations providing technology hardware and training to underserved communities.`,
  },
  {
    id: 'microsoft-tech',
    title: 'Microsoft Tech for Social Impact',
    funder: 'Microsoft',
    funderShort: 'Microsoft',
    award: '$150,000',
    awardSort: 150000,
    deadline: '2026-06-20',
    daysOut: 30,
    fit: 83,
    tags: ['EdTech', 'Corporate'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
    fitBreakdown: { missionAlignment: 88, geographicFocus: 85, programTrackrecord: 82, budgetCapacity: 80, partnershipReadiness: 76 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Azure for Nonprofits setup', done: false, source: 'Pending' },
    ],
    draftContent: `Microsoft's Tech for Social Impact program supports nonprofits using technology to amplify their social mission.`,
  },
  // Additional Science & Tech grants (Science & Tech: 4 -> 9)
  {
    id: 'darpa-educate',
    title: 'DARPA EDUCATE Program',
    funder: 'Defense Advanced Research Projects Agency',
    funderShort: 'DARPA',
    award: '$500,000',
    awardSort: 500000,
    deadline: '2026-07-01',
    daysOut: 41,
    fit: 70,
    tags: ['Science & Tech', 'Federal'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-17',
    fitBreakdown: { missionAlignment: 75, geographicFocus: 70, programTrackrecord: 72, budgetCapacity: 68, partnershipReadiness: 62 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Security clearance plan', done: false, source: 'In review' },
    ],
    draftContent: `DARPA's EDUCATE program supports STEM education initiatives that prepare students for advanced technology careers.`,
  },
  {
    id: 'doe-stem',
    title: 'DOE STEM Workforce Partnerships',
    funder: 'US Department of Energy',
    funderShort: 'DOE',
    award: '$300,000',
    awardSort: 300000,
    deadline: '2026-08-15',
    daysOut: 86,
    fit: 72,
    tags: ['Science & Tech', 'Federal'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-16',
    fitBreakdown: { missionAlignment: 78, geographicFocus: 72, programTrackrecord: 74, budgetCapacity: 70, partnershipReadiness: 64 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Energy sector partnerships', done: false, source: 'Outreach in progress' },
    ],
    draftContent: `The DOE STEM Workforce Partnerships program supports training for clean energy careers.`,
  },
  {
    id: 'epa-environmental',
    title: 'EPA Environmental Justice Tech',
    funder: 'Environmental Protection Agency',
    funderShort: 'EPA',
    award: '$200,000',
    awardSort: 200000,
    deadline: '2026-07-15',
    daysOut: 55,
    fit: 68,
    tags: ['Science & Tech', 'Federal'],
    status: 'draft',
    statusLabel: 'Drafting',
    matchedAt: '2026-05-12',
    fitBreakdown: { missionAlignment: 72, geographicFocus: 70, programTrackrecord: 68, budgetCapacity: 72, partnershipReadiness: 60 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Environmental tech curriculum', done: false, source: 'Planning' },
    ],
    draftContent: `The EPA's Environmental Justice Technology program supports community-based organizations using technology to address environmental disparities.`,
  },
  {
    id: 'nist-workforce',
    title: 'NIST Cybersecurity Workforce Program',
    funder: 'National Institute of Standards and Technology',
    funderShort: 'NIST',
    award: '$175,000',
    awardSort: 175000,
    deadline: '2026-06-30',
    daysOut: 40,
    fit: 74,
    tags: ['Science & Tech', 'Federal'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-18',
    fitBreakdown: { missionAlignment: 78, geographicFocus: 75, programTrackrecord: 76, budgetCapacity: 72, partnershipReadiness: 68 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Cybersecurity curriculum development', done: false, source: 'In progress' },
    ],
    draftContent: `NIST's Cybersecurity Workforce Program supports organizations training the next generation of cybersecurity professionals.`,
  },
  {
    id: 'nsf-research-exp',
    title: 'NSF Research Experiences for Teachers',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$120,000',
    awardSort: 120000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 76,
    tags: ['Science & Tech', 'Federal'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-14',
    fitBreakdown: { missionAlignment: 80, geographicFocus: 78, programTrackrecord: 78, budgetCapacity: 72, partnershipReadiness: 70 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'University research partnership', done: true, source: 'LOI submitted' },
      { label: 'Final proposal', done: false, source: 'In review' },
    ],
    draftContent: `NSF's Research Experiences for Teachers (RET) program supports teachers gaining research experience to improve STEM education.`,
  },
  // Additional Foundation grants (Foundation: 6 -> 16)
  {
    id: 'ellerslie-abc',
    title: 'Ellerslie Foundation ABC Initiative',
    funder: 'Ellerslie Foundation',
    funderShort: 'Ellerslie',
    award: '$60,000',
    awardSort: 60000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 82,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
    fitBreakdown: { missionAlignment: 86, geographicFocus: 84, programTrackrecord: 82, budgetCapacity: 78, partnershipReadiness: 76 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Community center partnerships', done: true, source: '3 MOUs signed' },
    ],
    draftContent: `The Ellerslie Foundation's ABC Initiative supports early childhood through adulthood educational pathways.`,
  },
  {
    id: 'packard-humanities',
    title: 'Packard Humanities Institute Grants',
    funder: 'David and Lucile Packard Foundation',
    funderShort: 'Packard',
    award: '$80,000',
    awardSort: 80000,
    deadline: '2026-07-01',
    daysOut: 41,
    fit: 78,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-18',
    fitBreakdown: { missionAlignment: 82, geographicFocus: 80, programTrackrecord: 78, budgetCapacity: 74, partnershipReadiness: 72 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Humanities + tech integration plan', done: false, source: 'Drafting' },
    ],
    draftContent: `The Packard Foundation supports organizations integrating humanities and technology education.`,
  },
  {
    id: 'skoll-social',
    title: 'Skoll Social Entrepreneurship Grants',
    funder: 'Skoll Foundation',
    funderShort: 'Skoll',
    award: '$150,000',
    awardSort: 150000,
    deadline: '2026-08-01',
    daysOut: 72,
    fit: 75,
    tags: ['Community', 'Foundation'],
    status: 'draft',
    statusLabel: 'Drafting',
    matchedAt: '2026-05-15',
    fitBreakdown: { missionAlignment: 80, geographicFocus: 76, programTrackrecord: 78, budgetCapacity: 72, partnershipReadiness: 68 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Social impact measurement plan', done: false, source: 'In progress' },
    ],
    draftContent: `The Skoll Foundation supports social entrepreneurs driving systemic change.`,
  },
  {
    id: 'walt-disney',
    title: 'Walt Disney Foundation Grants',
    funder: 'Walt Disney Company Foundation',
    funderShort: 'Disney',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-06-30',
    daysOut: 40,
    fit: 79,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-17',
    fitBreakdown: { missionAlignment: 84, geographicFocus: 82, programTrackrecord: 80, budgetCapacity: 76, partnershipReadiness: 72 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Youth storytelling program plan', done: false, source: 'Drafting' },
    ],
    draftContent: `The Walt Disney Foundation supports creative youth development programs.`,
  },
  {
    id: 'fresh-eq-fdn',
    title: 'Fresh Equality Foundation Grants',
    funder: 'Fresh Equality Foundation',
    funderShort: 'FreshEq',
    award: '$45,000',
    awardSort: 45000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 80,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-20',
    fitBreakdown: { missionAlignment: 84, geographicFocus: 82, programTrackrecord: 80, budgetCapacity: 76, partnershipReadiness: 74 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Fresh produce + tech combo program', done: false, source: 'Planning' },
    ],
    draftContent: `Fresh Equality Foundation supports programs addressing food access and digital equity together.`,
  },
  {
    id: 'tuberlin-fdn',
    title: 'TubeBerlin Innovation Fellowship',
    funder: 'TubeBerlin Foundation',
    funderShort: 'TubeBerlin',
    award: '$70,000',
    awardSort: 70000,
    deadline: '2026-07-15',
    daysOut: 55,
    fit: 72,
    tags: ['Community', 'Foundation'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-10',
    fitBreakdown: { missionAlignment: 76, geographicFocus: 74, programTrackrecord: 74, budgetCapacity: 70, partnershipReadiness: 66 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Fellowship curriculum', done: true, source: 'Complete' },
      { label: 'ED review', done: false, source: 'Scheduled May 25' },
    ],
    draftContent: `The TubeBerlin Innovation Fellowship supports emerging leaders in community technology.`,
  },
  {
    id: 'lumansa-fdn',
    title: 'Lumansa Foundation Tech Access',
    funder: 'Lumansa Foundation',
    funderShort: 'Lumansa',
    award: '$55,000',
    awardSort: 55000,
    deadline: '2026-06-01',
    daysOut: 11,
    fit: 81,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
    fitBreakdown: { missionAlignment: 85, geographicFocus: 83, programTrackrecord: 82, budgetCapacity: 77, partnershipReadiness: 75 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Tech access for seniors', done: false, source: 'In progress' },
    ],
    draftContent: `Lumansa Foundation supports technology access for underserved populations.`,
  },
  {
    id: 'bartini-fdn',
    title: 'Bartini Foundation Community Innovation',
    funder: 'Bartini Foundation',
    funderShort: 'Bartini',
    award: '$90,000',
    awardSort: 90000,
    deadline: '2026-07-30',
    daysOut: 70,
    fit: 77,
    tags: ['Community', 'Foundation'],
    status: 'draft',
    statusLabel: 'Drafting',
    matchedAt: '2026-05-12',
    fitBreakdown: { missionAlignment: 82, geographicFocus: 78, programTrackrecord: 78, budgetCapacity: 74, partnershipReadiness: 70 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Innovation hub design', done: false, source: 'Planning' },
    ],
    draftContent: `The Bartini Foundation supports community innovation hubs.`,
  },
  {
    id: 'seq-labs',
    title: 'Seq Labs Scientific Computing',
    funder: 'Seq Labs',
    funderShort: 'SeqLabs',
    award: '$65,000',
    awardSort: 65000,
    deadline: '2026-08-15',
    daysOut: 86,
    fit: 69,
    tags: ['Science & Tech', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-16',
    fitBreakdown: { missionAlignment: 72, geographicFocus: 68, programTrackrecord: 70, budgetCapacity: 74, partnershipReadiness: 62 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Computational thinking curriculum', done: false, source: 'Drafting' },
    ],
    draftContent: `Seq Labs supports computational education for life sciences.`,
  },
  // Additional Corporate grant (Corporate: 3 -> 4)
  {
    id: 'nvidia-deep-learning',
    title: 'NVIDIA Deep Learning Institute Grants',
    funder: 'NVIDIA Foundation',
    funderShort: 'NVIDIA',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-07-01',
    daysOut: 41,
    fit: 81,
    tags: ['Corporate', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-20',
    fitBreakdown: { missionAlignment: 85, geographicFocus: 88, programTrackrecord: 82, budgetCapacity: 78, partnershipReadiness: 74 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'GPU cluster access plan', done: false, source: 'Negotiating' },
    ],
    draftContent: `NVIDIA's Deep Learning Institute supports organizations teaching AI and machine learning skills.`,
  },
  // Additional Community grant (Community: 7 -> 8)
  {
    id: 'united-way-local',
    title: 'United Way Bay Area Community Grants',
    funder: 'United Way Bay Area',
    funderShort: 'UWBA',
    award: '$35,000',
    awardSort: 35000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 84,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-21',
    fitBreakdown: { missionAlignment: 88, geographicFocus: 90, programTrackrecord: 84, budgetCapacity: 78, partnershipReadiness: 80 },
    checklist: [
      { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
      { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
      { label: 'Collaborative impact reporting', done: false, source: 'In development' },
    ],
    draftContent: `United Way Bay Area's Community Grants support direct service organizations addressing immediate community needs.`,
  },
];

class Store {
  private data: StoreData;
  private storePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.storePath = path.join(app.getPath('userData'), 'store.json');
    this.data = this.loadStore();
  }

  private loadStore(): StoreData {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        const parsed = JSON.parse(data);
        log.info('Store loaded from:', this.storePath);
        // Migration: add new fields with defaults if missing from persisted store
        return {
          grants: parsed.grants || seedGrants,
          profile: parsed.profile || defaultProfile,
          crawlStatus: parsed.crawlStatus || { online: true, lastSync: new Date().toISOString() },
          notifications: parsed.notifications || [],
          tasks: parsed.tasks || [],
          documents: parsed.documents || [],
          activity: parsed.activity || [],
        };
      }
    } catch (error) {
      log.error('Error loading store:', error);
    }
    log.info('Initializing store with seed data');
    return {
      grants: seedGrants,
      profile: defaultProfile,
      crawlStatus: { online: true, lastSync: new Date().toISOString() },
      notifications: [],
      tasks: [],
      documents: [],
      activity: [],
    };
  }

  private saveStore(): void {
    // Debounce saves by 500ms
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const dir = path.dirname(this.storePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
        log.info('Store saved');
      } catch (error) {
        log.error('Error saving store:', error);
      }
    }, 500);
  }

  getGrants(): Grant[] {
    return this.data.grants;
  }

  getGrant(id: string): Grant | null {
    return this.data.grants.find((g) => g.id === id) || null;
  }

  updateGrant(id: string, updates: Partial<Grant>): void {
    const index = this.data.grants.findIndex((g) => g.id === id);
    if (index !== -1) {
      this.data.grants[index] = { ...this.data.grants[index], ...updates };
      this.saveStore();
    }
  }

  addGrant(grant: Grant): void {
    this.data.grants.push(grant);
    this.saveStore();
  }

  getProfile(): OrganizationProfile {
    return this.data.profile;
  }

  updateProfile(profile: OrganizationProfile): void {
    this.data.profile = profile;
    this.saveStore();
  }

  // Crawl status methods
  getCrawlStatus(): CrawlStatus {
    return this.data.crawlStatus;
  }

  updateCrawlStatus(status: CrawlStatus): void {
    this.data.crawlStatus = status;
    this.saveStore();
  }

  // Notification methods
  getNotifications(): Notification[] {
    return this.data.notifications;
  }

  updateNotifications(notifications: Notification[]): void {
    this.data.notifications = notifications;
    this.saveStore();
  }

  // Task methods
  getTasks(): Task[] {
    return this.data.tasks;
  }

  updateTasks(tasks: Task[]): void {
    this.data.tasks = tasks;
    this.saveStore();
  }

  // Document methods
  getDocuments(): DocumentMetadata[] {
    return this.data.documents;
  }

  addDocument(doc: DocumentMetadata): void {
    this.data.documents.push(doc);
    this.saveStore();
  }

  // Activity methods
  getActivity(): ActivityEvent[] {
    return this.data.activity;
  }

  addActivityEvent(event: ActivityEvent): void {
    this.data.activity.push(event);
    this.saveStore();
  }

  getRecentActivity(count: number): ActivityEvent[] {
    return this.data.activity.slice(-count);
  }
}

export const store = new Store();
