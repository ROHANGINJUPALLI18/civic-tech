export const COMPLAINT_STATES = [
  "Reported",
  "Pre-Validation",
  "Assigned",
  "In Progress",
  "Work Uploaded",
  "User Confirmation",
  "Closed",
];

export const BASE_TRANSITIONS = {
  Reported: ["Pre-Validation"],
  "Pre-Validation": ["Assigned"],
  Assigned: ["In Progress"],
  "In Progress": ["Work Uploaded"],
  "Work Uploaded": ["User Confirmation"],
  "User Confirmation": ["Closed"],
  Closed: [],
};

const HIGH_PRIORITY_CATEGORIES = new Set(["Sewage Overflow", "Streetlight"]);

export function canTransition(
  currentState,
  nextState,
  requiresManagerReview = false,
) {
  return BASE_TRANSITIONS[currentState]?.includes(nextState) ?? false;
}

export function getNextState(currentState, requiresManagerReview = false) {
  const transitions = BASE_TRANSITIONS[currentState] ?? [];
  return transitions[0] ?? null;
}

function haversineMeters(a, b) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function hoursBetween(nowIso, thenIso) {
  return (
    Math.abs(new Date(nowIso).getTime() - new Date(thenIso).getTime()) / 3600000
  );
}

export function classifyIssue(categoryHint) {
  const confidenceMap = {
    Pothole: 0.87,
    Garbage: 0.73,
    Streetlight: 0.81,
    "Sewage Overflow": 0.78,
  };

  const confidence = confidenceMap[categoryHint] ?? 0.55;

  if (confidence >= 0.8) {
    return { confidence, decision: "auto" };
  }

  if (confidence >= 0.6) {
    return { confidence, decision: "community" };
  }

  return { confidence, decision: "manual" };
}

export function detectDuplicate(incomingComplaint, complaints) {
  const duplicateWindowHours = 72;

  let bestMatch = null;
  let bestScore = 0;

  for (const existing of complaints) {
    const distance = haversineMeters(
      incomingComplaint.location,
      existing.location,
    );
    const withinRadius = distance <= 50;
    const categoryMatch = existing.category === incomingComplaint.category;
    const withinTime =
      hoursBetween(incomingComplaint.createdAt, existing.createdAt) <=
      duplicateWindowHours;
    const sameImage = existing.imageHash === incomingComplaint.imageHash;

    let score = 0;
    if (withinRadius) score += 0.35;
    if (categoryMatch) score += 0.25;
    if (withinTime) score += 0.2;
    if (sameImage) score += 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        complaintId: existing.id,
        distanceMeters: Math.round(distance),
        score,
      };
    }
  }

  if (!bestMatch || bestScore < 0.6) {
    return { isDuplicate: false, match: null };
  }

  return { isDuplicate: true, match: bestMatch };
}

export function runPreValidation(incomingComplaint, complaints) {
  const classification = classifyIssue(incomingComplaint.category);
  const duplicate = detectDuplicate(incomingComplaint, complaints);

  const suspiciousSignals = [];
  if (incomingComplaint.internetHashMatch)
    suspiciousSignals.push("Internet image hash match");
  if (!incomingComplaint.metadataValid)
    suspiciousSignals.push("Metadata mismatch");
  if (incomingComplaint.reusedImageAcrossUsers)
    suspiciousSignals.push("Possible reused image");

  return {
    classification,
    duplicate,
    suspiciousSignals,
    hardBlock: false,
    flaggedForHumanReview:
      classification.decision === "manual" || suspiciousSignals.length > 0,
  };
}

export function runResolutionValidation(beforeEvidence, afterEvidence) {
  const suspiciousSignals = [];

  const suspiciousSsim = afterEvidence.ssim >= 0.92;
  if (suspiciousSsim)
    suspiciousSignals.push("Before/after similarity too high");

  const objectStillPresent = afterEvidence.objectDetected;
  if (objectStillPresent)
    suspiciousSignals.push("Object still detected in after image");

  const requiresManagerReview = suspiciousSsim || objectStillPresent;

  return {
    requiresManagerReview,
    suspiciousSignals,
    beforeEvidence,
    afterEvidence,
  };
}

export function computeSlaRisk(complaint) {
  const priorityWeight = HIGH_PRIORITY_CATEGORIES.has(complaint.category)
    ? 1.4
    : 1;
  const ageHours = hoursBetween(new Date().toISOString(), complaint.createdAt);
  const ratio = (ageHours / complaint.slaHours) * priorityWeight;

  if (ratio >= 1) return "breach";
  if (ratio >= 0.7) return "warning";
  return "healthy";
}

export function computeTechnicianTrust(technician) {
  return (
    technician.validatedResolutions * 4 -
    technician.disputes * 3 -
    technician.falseCompletions * 8
  );
}
