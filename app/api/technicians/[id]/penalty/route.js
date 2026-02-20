import { NextResponse } from "next/server";

import { readStore, writeStore } from "@/lib/store";

export async function POST(_, { params }) {
  const { id } = await params;
  const store = await readStore();
  const technician = store.technicians.find((item) => item.id === id);

  if (!technician) {
    return NextResponse.json(
      { message: "Technician not found" },
      { status: 404 },
    );
  }

  const updatedTechnicians = store.technicians.map((item) =>
    item.id === id
      ? { ...item, falseCompletions: item.falseCompletions + 1 }
      : item,
  );

  const nextStore = {
    ...store,
    technicians: updatedTechnicians,
    logs: [
      `Manager penalty applied to ${technician.name} for false completion.`,
      ...store.logs,
    ].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json(nextStore);
}
