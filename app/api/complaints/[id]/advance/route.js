import { NextResponse } from "next/server";

import { readStore, writeStore } from "@/lib/store";
import { computeTechnicianTrust, getNextState } from "@/lib/workflow";

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

  const nextState = getNextState(complaint.state, false);

  if (!nextState) {
    return NextResponse.json(
      { message: "No further transitions available" },
      { status: 400 },
    );
  }

  let assignedTechnicianId = complaint.assignedTechnicianId;
  let updatedTechnicians = store.technicians;
  const logsToAdd = [];

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
