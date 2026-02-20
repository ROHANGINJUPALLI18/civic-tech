import { NextResponse } from "next/server";

import { readStore, writeStore } from "@/lib/store";
import {
  computeTechnicianTrust,
  getNextState,
  runPreValidation,
  runResolutionValidation,
} from "@/lib/workflow";

function getRoutingSuggestion(technicians) {
  const candidates = technicians
    .map((technician) => ({
      ...technician,
      trust: computeTechnicianTrust(technician),
    }))
    .sort(
      (a, b) => b.trust - a.trust || a.activeAssignments - b.activeAssignments,
    );

  return candidates[0] ?? null;
}

export async function POST(_, { params }) {
  const { id } = await params;
  const store = await readStore();
  const complaint = store.complaints.find((item) => item.id === id);

  if (!complaint) {
    return NextResponse.json(
      { message: "Complaint not found" },
      { status: 404 },
    );
  }

  const preValidation = runPreValidation(complaint, store.complaints);
  const resolutionValidation = runResolutionValidation(
    complaint.beforeEvidence,
    complaint.afterEvidence,
  );

  const nextState = getNextState(
    complaint.state,
    resolutionValidation.requiresManagerReview,
  );

  if (!nextState) {
    return NextResponse.json(
      { message: "No further transitions available" },
      { status: 400 },
    );
  }

  let assignedTechnicianId = complaint.assignedTechnicianId;
  let updatedTechnicians = store.technicians;
  const logsToAdd = [];

  if (complaint.state === "Verified") {
    const routed = getRoutingSuggestion(store.technicians);
    if (routed) {
      assignedTechnicianId = routed.id;
      updatedTechnicians = store.technicians.map((tech) =>
        tech.id === routed.id
          ? { ...tech, activeAssignments: tech.activeAssignments + 1 }
          : tech,
      );
      logsToAdd.push(
        `${complaint.id} routed to ${routed.name} by load + trust policy.`,
      );
    }
  }

  if (
    complaint.state === "AI Pre-Validation" &&
    preValidation.flaggedForHumanReview
  ) {
    logsToAdd.push(
      `${complaint.id} soft-flagged: ${preValidation.suspiciousSignals.join(", ") || "low confidence"}.`,
    );
  }

  if (
    complaint.state === "AI Resolution Validation" &&
    resolutionValidation.requiresManagerReview
  ) {
    logsToAdd.push(
      `${complaint.id} flagged for manager review: ${resolutionValidation.suspiciousSignals.join(", ")}.`,
    );
  }

  if (nextState === "Closed") {
    logsToAdd.push(`${complaint.id} closed after user confirmation.`);
    if (assignedTechnicianId) {
      updatedTechnicians = updatedTechnicians.map((tech) =>
        tech.id === assignedTechnicianId
          ? {
              ...tech,
              activeAssignments: Math.max(0, tech.activeAssignments - 1),
            }
          : tech,
      );
    }
  }

  const updatedComplaints = store.complaints.map((item) =>
    item.id === complaint.id
      ? {
          ...item,
          state: nextState,
          assignedTechnicianId,
        }
      : item,
  );

  const nextStore = {
    ...store,
    complaints: updatedComplaints,
    technicians: updatedTechnicians,
    logs: [...logsToAdd, ...store.logs].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json(nextStore);
}
