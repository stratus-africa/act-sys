export const APPLICANT_POSITIONS = [
  { value: "rn", label: "Registered Nurse (RN)" },
  { value: "pca", label: "Personal Care Aide (PCA)" },
  { value: "caregiver", label: "Caregiver" },
  { value: "other", label: "Other" },
] as const;

export const APPLICANT_STATUSES = [
  { value: "applied", label: "Applied", tone: "neutral" },
  { value: "screening", label: "Screening", tone: "amber" },
  { value: "background", label: "Background Check", tone: "amber" },
  { value: "interview", label: "Interview", tone: "amber" },
  { value: "offer", label: "Offer Extended", tone: "primary" },
  { value: "hired", label: "Hired", tone: "primary" },
  { value: "rejected", label: "Rejected", tone: "destructive" },
  { value: "withdrawn", label: "Withdrawn", tone: "muted" },
] as const;

export const ONBOARDING_DOCS = [
  { kind: "application", label: "Employment Application", required: true },
  { kind: "criminal_background", label: "Criminal Background Inquiry", required: true },
  { kind: "background_check", label: "Background Check (third-party)", required: true },
  { kind: "lifting_agreement", label: "Lifting & Pulling Agreement", required: true },
  { kind: "at_will", label: "At-Will Employment Acknowledgement", required: true },
  { kind: "ethics", label: "Code of Ethics", required: true },
  { kind: "confidentiality", label: "Confidentiality & Privacy Agreement", required: true },
  { kind: "hepatitis_b", label: "Hepatitis B Vaccine Acknowledgement", required: true },
  { kind: "tb_review", label: "Tuberculosis Symptom Review", required: true },
  { kind: "health_certificate", label: "Health Certificate / Physical Exam", required: true },
  { kind: "training_ack", label: "Training / Orientation Acknowledgement", required: true },
  { kind: "reference_check", label: "Reference Check", required: false },
  { kind: "w4", label: "W-4 Form", required: true },
  { kind: "w9", label: "W-9 Form (Contractors)", required: false },
  { kind: "contractor_agreement", label: "Contractor Agreement (Side A & B)", required: false },
] as const;

export const PCA_SKILLS: Array<{ group: string; items: string[] }> = [
  {
    group: "ADLs",
    items: [
      "Bathing", "Bathing the Infant", "Bathing the Child", "Positioning the Infant",
      "Brushing the Teeth", "Flossing the Teeth", "Performing Mouth Care",
      "Dressing", "Dressing the Infant", "Dressing the Child", "Changing the Diaper", "Washing the Hair",
    ],
  },
  {
    group: "Vital Signs",
    items: ["Auxiliary Temps", "Pulse", "Special Skin Care"],
  },
  {
    group: "Range of Motion",
    items: ["Active", "Passive"],
  },
  {
    group: "Universal Precautions / Safety",
    items: [
      "Safety and Activity", "Identifying signs of stroke", "Identifying signs of heart attack",
      "Identifying signs of hypo- and hyperglycemia", "Determining Patient's ID",
      "Identifying Safety Hazards", "Maintaining Clean, Orderly Work Area",
      "Disposing of Sharp Objects", "Handling Hazardous Materials", "Proper Body Mechanics",
    ],
  },
  {
    group: "Mobility / Transfers",
    items: [
      "Transferring to Bed, WC, Commode, etc.", "Turning and Positioning", "Use Hoyer Lift",
      "Use of Equipment", "Use of Crutches", "Use of Walker", "Use of Cane",
      "Use of Wheelchair and Locks", "Use of Transfer Belt", "Use of Gait Belt for Ambulation",
    ],
  },
  {
    group: "Communication & Reporting",
    items: [
      "Communication of RN", "Changes in Patient Condition", "Patient Needs, Complaints and Concerns",
      "Unusual Incidents", "Charting", "Vital Signs", "Bowel Movements",
      "Medication Intake", "Diet Intake, Calorie Count",
    ],
  },
  {
    group: "Infection Control",
    items: [
      "Use of Gloves", "Use of Gowns / Wearing of Scrubs", "Use of Masks / Goggles",
      "Hand Washing Precaution", "Infectious or Hazardous Waste Disposal",
      "Use of CPR Mask or Bag", "Isolation Techniques",
    ],
  },
  {
    group: "Specimen Collection",
    items: ["Collecting Sputum", "Collecting Clean Catch Urine", "Collecting Stool"],
  },
  {
    group: "GI / GU",
    items: ["Feeding", "Aspiration Precautions", "Signs of Aspiration", "Emptying Foley Bag"],
  },
];

export const CREDENTIAL_KINDS = [
  { value: "license", label: "Professional License (RN / LPN / CNA)" },
  { value: "cpr", label: "CPR Certification" },
  { value: "bls", label: "BLS Certification" },
  { value: "tb_test", label: "TB Test / Screening" },
  { value: "hepatitis_b", label: "Hepatitis B Vaccination" },
  { value: "physical", label: "Physical Exam" },
  { value: "driver_license", label: "Driver's License" },
  { value: "auto_insurance", label: "Auto Insurance" },
  { value: "background_check", label: "Background Check" },
  { value: "other", label: "Other" },
] as const;

export function skillKey(group: string, item: string) {
  return `${group}::${item}`;
}
