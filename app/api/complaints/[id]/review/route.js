import { NextResponse } from "next/server";

import { readStore, writeStore } from "@/lib/store";

export async function POST(request, { params }) {
  const { id } = await params;
  const payload = await request.json();

  const accepted = Boolean(payload?.accepted);
  const rating = Math.max(
    1,
    Math.min(5, Number(payload?.rating) || (accepted ? 5 : 1)),
  );

  const store = await readStore();
  const complaint = store.complaints.find((item) => item.id === id);

  if (!complaint) {
    return NextResponse.json(
      { message: "Complaint not found" },
      { status: 404 },
    );
  }

  const technicianId = complaint.assignedTechnicianId;
  const nextState = accepted ? "Closed" : "In Progress";

  const updatedTechnicians = store.technicians.map((tech) => {
    if (tech.id !== technicianId) return tech;

    if (accepted) {
      return {
        ...tech,
        validatedResolutions: tech.validatedResolutions + 1,
        activeAssignments: Math.max(0, tech.activeAssignments - 1),
      };
    }

    return {
      ...tech,
      disputes: tech.disputes + 1,
      activeAssignments: tech.activeAssignments + 1,
    };
  });

  const nextStore = {
    ...store,
    complaints: store.complaints.map((item) =>
      item.id === complaint.id
        ? {
            ...item,
            state: nextState,
            userReview: {
              accepted,
              rating,
              reviewedAt: new Date().toISOString(),
            },
          }
        : item,
    ),
    technicians: updatedTechnicians,
    logs: [
      accepted
        ? `User accepted resolution for ${complaint.id} (rating ${rating}/5).`
        : `User disputed resolution for ${complaint.id}; sent back to in-progress for rework.`,
      ...store.logs,
    ].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json(nextStore);
}
