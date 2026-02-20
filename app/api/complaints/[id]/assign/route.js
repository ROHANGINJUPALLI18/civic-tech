import { NextResponse } from "next/server";

import { readStore, writeStore } from "@/lib/store";

export async function POST(request, { params }) {
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const technicianId = String(payload?.technicianId || "").trim();

  if (!technicianId) {
    return NextResponse.json(
      { message: "Technician is required for assignment." },
      { status: 400 },
    );
  }

  const store = await readStore();
  const complaint = store.complaints.find((item) => item.id === id);

  if (!complaint) {
    return NextResponse.json(
      { message: "Complaint not found" },
      { status: 404 },
    );
  }

  const technician = store.technicians.find((item) => item.id === technicianId);
  if (!technician) {
    return NextResponse.json(
      { message: "Selected technician not found." },
      { status: 400 },
    );
  }

  const previousTechnicianId = complaint.assignedTechnicianId || null;

  const updatedComplaints = store.complaints.map((item) =>
    item.id === id
      ? {
          ...item,
          assignedTechnicianId: technicianId,
          state: "Assigned",
        }
      : item,
  );

  const updatedTechnicians = store.technicians.map((item) => {
    if (item.id === technicianId && previousTechnicianId !== technicianId) {
      return {
        ...item,
        activeAssignments: (item.activeAssignments || 0) + 1,
      };
    }

    if (previousTechnicianId && item.id === previousTechnicianId) {
      return {
        ...item,
        activeAssignments: Math.max(0, (item.activeAssignments || 0) - 1),
      };
    }

    return item;
  });

  const nextStore = {
    ...store,
    complaints: updatedComplaints,
    technicians: updatedTechnicians,
    logs: [
      `${id} reviewed by authority and assigned to ${technicianId}.`,
      ...store.logs,
    ].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json({ store: nextStore });
}
