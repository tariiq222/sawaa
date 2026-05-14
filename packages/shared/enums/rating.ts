export enum ProblemReportType {
  WAIT_TIME = 'wait_time',
  STAFF_BEHAVIOR = 'staff_behavior',
  CLEANLINESS = 'cleanliness',
  BILLING = 'billing',
  NO_CALL = 'no_call',
  LATE = 'late',
  TECHNICAL = 'technical',
  OTHER = 'other',
}

export enum ProblemReportStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}
