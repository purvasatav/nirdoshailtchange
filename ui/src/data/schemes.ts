import type { Answers, Scheme, SchemeCategory } from '../types/schemes';

export const categories: { id: 'all' | SchemeCategory; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'farmer', label: 'Farmer' },
  { id: 'student', label: 'Student' },
  { id: 'women', label: 'Women' },
  { id: 'senior', label: 'Senior Citizen' },
  { id: 'general', label: 'General' },
];

export const stepFields: (keyof Answers)[][] = [
  ['gender', 'student'],
  ['farmer', 'bpl'],
  ['senior', 'aadhaar'],
];

export const schemes: Scheme[] = [
  {
    id: 'pm-kisan',
    name: 'PM-Kisan Samman Nidhi',
    desc: 'Financial support of ₹6,000 per year for landholding farmer families across India.',
    category: 'farmer',
    benefit: '₹6,000 / year',
    docs: ['Aadhaar Card', 'Land holding record', 'Bank account details'],
    url: 'https://pmkisan.gov.in/',
    domain: 'pmkisan.gov.in',
    officialSourceLabel: 'Ministry of Agriculture and Farmers Welfare',
    check: (a: Answers) => {
      if (a.farmer === undefined) {
        return {
          status: 'more_information_needed',
          reason: 'Farmer status was not specified in the preliminary questionnaire.',
          matchedSignals: [],
          missingSignals: ['Farmer occupation status'],
        };
      }
      if (a.farmer === 'yes') {
        return {
          status: 'potential_match',
          reason: 'Farmer status declared in preliminary check.',
          matchedSignals: ['Farmer status declared'],
          missingSignals: [
            'Landholding ownership record not checked',
            'Income tax payer exclusion not checked',
          ],
        };
      }
      return {
        status: 'may_not_match',
        reason: 'PM-Kisan is intended for landholding farmer families; non-farmer status was declared.',
        matchedSignals: [],
        missingSignals: ['Farmer occupation status'],
      };
    },
  },
  {
    id: 'pmjay',
    name: 'Ayushman Bharat (PM-JAY)',
    desc: 'Health cover up to ₹5 lakh per family per year for secondary and tertiary hospitalisation.',
    category: 'general',
    benefit: 'Up to ₹5,00,000 cover',
    docs: ['Aadhaar Card', 'Ration Card / BPL Proof'],
    url: 'https://beneficiary.nha.gov.in/',
    domain: 'nha.gov.in',
    officialSourceLabel: 'National Health Authority (NHA)',
    check: (a: Answers) => {
      if (a.bpl === undefined && a.senior === undefined) {
        return {
          status: 'more_information_needed',
          reason: 'Income category or age information needed for preliminary assessment.',
          matchedSignals: [],
          missingSignals: ['BPL household category or Senior Citizen status'],
        };
      }
      const matched: string[] = [];
      if (a.bpl === 'yes') matched.push('Low income / BPL category declared');
      if (a.senior === 'yes') matched.push('Senior citizen profile declared');

      if (matched.length > 0) {
        return {
          status: 'potential_match',
          reason: 'BPL or senior citizen profile indicates potential relevance.',
          matchedSignals: matched,
          missingSignals: [
            'SECC 2011 / Ayushman Bharat beneficiary database entry not checked',
            'Hospital admission policy conditions not checked',
          ],
        };
      }
      return {
        status: 'may_not_match',
        reason: 'PM-JAY focuses primarily on low-income BPL households listed in SECC 2011 or senior citizens aged 70+.',
        matchedSignals: [],
        missingSignals: ['BPL listing or age 70+ qualification criteria'],
      };
    },
  },
  {
    id: 'pmuy',
    name: 'PM Ujjwala Yojana (PMUY)',
    desc: 'Deposit-free LPG connection for adult women from deprived or BPL households.',
    category: 'women',
    benefit: 'Deposit-free LPG Connection',
    docs: ['Aadhaar Card', 'BPL Card / Ration Card', 'Bank Account details'],
    url: 'https://www.pmuy.gov.in/',
    domain: 'pmuy.gov.in',
    officialSourceLabel: 'Ministry of Petroleum and Natural Gas',
    check: (a: Answers) => {
      if (a.gender === undefined && a.bpl === undefined) {
        return {
          status: 'more_information_needed',
          reason: 'Gender and household economic category needed for preliminary check.',
          matchedSignals: [],
          missingSignals: ['Adult female applicant status', 'BPL / deprived household status'],
        };
      }
      if (a.gender === 'male') {
        return {
          status: 'may_not_match',
          reason: 'LPG connections under PMUY are issued in the name of an adult female family member.',
          matchedSignals: [],
          missingSignals: ['Adult female applicant requirement'],
        };
      }
      if (a.bpl === 'no') {
        return {
          status: 'may_not_match',
          reason: 'Scheme is targeted to deprived/BPL households.',
          matchedSignals: a.gender === 'female' ? ['Female applicant declared'] : [],
          missingSignals: ['BPL / deprived household category'],
        };
      }
      if (a.gender === 'female' && a.bpl === 'yes') {
        return {
          status: 'potential_match',
          reason: 'Adult female applicant and BPL household profile declared.',
          matchedSignals: ['Female applicant declared', 'BPL household declared'],
          missingSignals: [
            'Existing LPG connection check required',
            'Ration card / SECC 2011 list check required',
          ],
        };
      }
      return {
        status: 'more_information_needed',
        reason: 'Complete gender and household details needed.',
        matchedSignals: a.gender === 'female' ? ['Female applicant declared'] : [],
        missingSignals: ['BPL category verification'],
      };
    },
  },
  {
    id: 'nmmss',
    name: 'National Means-cum-Merit Scholarship (NMMSS)',
    desc: 'Financial assistance for meritorious students of economically weaker sections to reduce dropouts.',
    category: 'student',
    benefit: '₹12,000 / year',
    docs: ['Aadhaar Card', 'Class 8 Marksheet', 'Income Certificate'],
    url: 'https://scholarships.gov.in/',
    domain: 'scholarships.gov.in',
    officialSourceLabel: 'Ministry of Education',
    check: (a: Answers) => {
      if (a.student === undefined) {
        return {
          status: 'more_information_needed',
          reason: 'Student enrollment status needed.',
          matchedSignals: [],
          missingSignals: ['Enrolled student status'],
        };
      }
      if (a.student === 'yes') {
        return {
          status: 'potential_match',
          reason: 'Student status declared for preliminary scholarship screening.',
          matchedSignals: ['Enrolled student profile'],
          missingSignals: [
            'Class 8 enrollment check required',
            'Parental annual income limit (≤ ₹3.5 lakh) not checked',
            'Academic marks threshold not checked',
          ],
        };
      }
      return {
        status: 'may_not_match',
        reason: 'Scholarship scheme is intended for currently enrolled students.',
        matchedSignals: [],
        missingSignals: ['Enrolled student status'],
      };
    },
  },
  {
    id: 'pmsym',
    name: 'PM Shram Yogi Maandhan (PM-SYM)',
    desc: 'Voluntary and contributory pension scheme for unorganised workers.',
    category: 'senior',
    benefit: '₹3,000 / month pension (after age 60)',
    docs: ['Aadhaar Card', 'Savings Bank Account / Jan Dhan Account'],
    url: 'https://maandhan.in/',
    domain: 'maandhan.in',
    officialSourceLabel: 'Ministry of Labour and Employment',
    check: (a: Answers) => {
      if (a.senior === 'yes') {
        return {
          status: 'may_not_match',
          reason: 'Entry age for PM-SYM is 18 to 40 years; current senior citizens (60+) cannot enroll as new subscribers.',
          matchedSignals: [],
          missingSignals: ['Entry age 18-40 criteria'],
        };
      }
      return {
        status: 'more_information_needed',
        reason: 'This scheme has age (18-40), unorganised worker occupation, income (≤ ₹15,000/mo), and contribution conditions that require official verification.',
        matchedSignals: [],
        missingSignals: [
          'Unorganised worker occupation status',
          'Monthly income ≤ ₹15,000 limit',
          'Entry age 18-40 verification',
        ],
      };
    },
  },
  {
    id: 'pmjdy',
    name: 'Pradhan Mantri Jan-Dhan Yojana (PMJDY)',
    desc: 'National mission for financial inclusion providing zero-balance savings accounts with RuPay debit card.',
    category: 'general',
    benefit: 'Zero-balance Account & RuPay Card',
    docs: ['Aadhaar Card or any valid KYC document (Voter ID, DL, PAN, NREGA)'],
    url: 'https://www.pmjdy.gov.in/',
    domain: 'pmjdy.gov.in',
    officialSourceLabel: 'Department of Financial Services, Ministry of Finance',
    check: (a: Answers) => {
      if (a.aadhaar === undefined) {
        return {
          status: 'more_information_needed',
          reason: 'Identity document availability details needed.',
          matchedSignals: [],
          missingSignals: ['KYC document availability'],
        };
      }
      if (a.aadhaar === 'yes') {
        return {
          status: 'potential_match',
          reason: 'Aadhaar simplifies KYC, though other valid KYC documents are also accepted at participating banks.',
          matchedSignals: ['Aadhaar available for simplified KYC'],
          missingSignals: ['Existing bank account status not checked'],
        };
      }
      return {
        status: 'potential_match',
        reason: 'Open to unbanked individuals using any valid KYC document (Voter ID, Driving Licence, PAN, or NREGA card).',
        matchedSignals: ['Universal account opening eligibility'],
        missingSignals: ['KYC document verification at bank branch'],
      };
    },
  },
];
