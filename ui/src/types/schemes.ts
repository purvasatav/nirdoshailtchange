export type Answers = {
  gender?: 'male' | 'female' | 'other';
  student?: 'yes' | 'no';
  farmer?: 'yes' | 'no';
  bpl?: 'yes' | 'no';
  senior?: 'yes' | 'no';
  aadhaar?: 'yes' | 'no';
};

export type SchemeCategory =
  | 'farmer'
  | 'student'
  | 'women'
  | 'senior'
  | 'general';

export type SchemeMatchStatus =
  | 'potential_match'
  | 'may_not_match'
  | 'more_information_needed';

export type SchemeCheckResult = {
  status: SchemeMatchStatus;
  reason: string;
  matchedSignals: string[];
  missingSignals: string[];
};

export type Scheme = {
  id: string;
  name: string;
  desc: string;
  category: SchemeCategory;
  benefit: string;
  docs: string[];
  url: string;
  domain: string;
  officialSourceLabel: string;
  check: (answers: Answers) => SchemeCheckResult;
};
