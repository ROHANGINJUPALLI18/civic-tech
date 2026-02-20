import { NextResponse } from "next/server";

import { saveImageFile } from "@/lib/image-validation";
import { readStore, writeStore } from "@/lib/store";

function parseCoordinate(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

export async function POST(request, { params }) {
  const { id } = await params;
  const contentType = request.headers.get("content-type") || "";

  let payload;
  let afterImageFile;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    payload = {
      proofCaptured:
        String(formData.get("proofCaptured") || "false") === "true",
      scanConfirmed:
        String(formData.get("scanConfirmed") || "false") === "true",
      afterLatitude: parseCoordinate(formData.get("afterLatitude")),
      afterLongitude: parseCoordinate(formData.get("afterLongitude")),
    };
    afterImageFile = formData.get("afterImage");
  } else {
    payload = await request.json();
  }

  const store = await readStore();
  const complaint = store.complaints.find((item) => item.id === id);

  if (!complaint) {
    return NextResponse.json(
      { message: "Complaint not found" },
      { status: 404 },
    );
  }

  if (!["Assigned", "In Progress"].includes(complaint.state)) {
    return NextResponse.json(
      {
        message: "Complaint is not ready for technician completion submission",
      },
      { status: 400 },
    );
  }

  if (!afterImageFile || typeof afterImageFile.arrayBuffer !== "function") {
    return NextResponse.json(
      { message: "After-work image is required" },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(payload.afterLatitude) ||
    !Number.isFinite(payload.afterLongitude)
  ) {
    return NextResponse.json(
      {
        message:
          "Problem solver location coordinates are required for work upload validation.",
      },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(complaint?.location?.lat) ||
    !Number.isFinite(complaint?.location?.lng)
  ) {
    return NextResponse.json(
      {
        message: "Complaint location missing. Unable to validate completion.",
      },
      { status: 400 },
    );
  }

  const locationDistanceMeters = haversineMeters(
    { lat: complaint.location.lat, lng: complaint.location.lng },
    { lat: payload.afterLatitude, lng: payload.afterLongitude },
  );

  if (locationDistanceMeters > 120) {
    return NextResponse.json(
      {
        message:
          "Work upload rejected: problem solver location does not match complaint location.",
      },
      { status: 400 },
    );
  }

  const savedAfterImage = await saveImageFile(afterImageFile, "after-work");
  const afterEvidence = {
    objectDetected: false,
    ssim: null,
    aiResolved: null,
    aiConfidence: null,
    aiReason: null,
    locationMatch: true,
    locationDistanceMeters: Math.round(locationDistanceMeters),
    afterCoordinates: {
      lat: payload.afterLatitude,
      lng: payload.afterLongitude,
    },
    beforeCoordinates: {
      lat: complaint.location.lat,
      lng: complaint.location.lng,
    },
    imagePath: savedAfterImage.relativePath,
  };

  const nextStore = {
    ...store,
    complaints: store.complaints.map((item) =>
      item.id === complaint.id
        ? {
            ...item,
            state: "User Confirmation",
            afterEvidence,
            technicianSubmission: {
              submittedAt: new Date().toISOString(),
              proofCaptured: Boolean(payload?.proofCaptured),
              scanConfirmed: Boolean(payload?.scanConfirmed),
            },
          }
        : item,
    ),
    logs: [
      `${complaint.id} work uploaded and location validated (${Math.round(locationDistanceMeters)}m). Awaiting user confirmation.`,
      ...store.logs,
    ].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json(nextStore);
}
