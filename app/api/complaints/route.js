import { NextResponse } from "next/server";

import { computeAverageHash, saveImageFile } from "@/lib/image-validation";
import { readStore, writeStore } from "@/lib/store";

function mapDepartment(category) {
  if (category === "Pothole") return "Roads";
  if (category === "Garbage") return "Sanitation";
  if (category === "Streetlight") return "Utilities";
  if (category === "Drainage") return "Infrastructure";
  if (category === "Sewage Overflow") return "Sewage";
  return "General";
}

function parseCoordinate(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function generateComplaint(payload, imageContext) {
  const createdAt = new Date().toISOString();

  return {
    id: `CIV-${Math.floor(1000 + Math.random() * 9000)}`,
    title: payload.title,
    description: payload.description,
    reporterName: payload.reporterName,
    category: payload.category,
    department: mapDepartment(payload.category),
    state: "Reported",
    location:
      payload.location &&
      Number.isFinite(payload.location.lat) &&
      Number.isFinite(payload.location.lng)
        ? payload.location
        : {
            lat: 28.6138 + Math.random() / 5000,
            lng: 77.209 + Math.random() / 5000,
          },
    ward: payload.ward,
    scanConfirmed: Boolean(payload.scanConfirmed),
    scanTimestamp: Boolean(payload.scanConfirmed) ? createdAt : null,
    createdAt,
    slaHours: ["Sewage Overflow", "Drainage"].includes(payload.category)
      ? 12
      : 24,
    imageHash: imageContext.hash,
    imageAnalyzerHash: null,
    imagePath: imageContext.path,
    metadataValid: Boolean(payload.scanConfirmed),
    internetHashMatch: false,
    reusedImageAcrossUsers: false,
    communityWeight: 1,
    assignedTechnicianId: payload.assignedTechnicianId || null,
    beforeEvidence: {
      objectDetected: true,
      ssim: 0.22,
      capturedAt: payload.complaintImageCapturedAt || createdAt,
      coordinates:
        payload.location &&
        Number.isFinite(payload.location.lat) &&
        Number.isFinite(payload.location.lng)
          ? { lat: payload.location.lat, lng: payload.location.lng }
          : null,
    },
    afterEvidence: { objectDetected: false, ssim: 0.42 },
  };
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store.complaints);
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let payload;
    let complaintImageFile;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      payload = {
        reporterName: String(formData.get("reporterName") || ""),
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || ""),
        category: String(formData.get("category") || ""),
        ward: String(formData.get("ward") || ""),
        latitude: parseCoordinate(formData.get("latitude")),
        longitude: parseCoordinate(formData.get("longitude")),
        complaintImageCapturedAt: String(
          formData.get("complaintImageCapturedAt") || "",
        ),
        scanConfirmed:
          String(formData.get("scanConfirmed") || "false") === "true",
      };
      complaintImageFile = formData.get("complaintImage");
    } else {
      payload = await request.json();
    }

    if (
      !payload?.title?.trim() ||
      !payload?.category ||
      !payload?.ward?.trim() ||
      !payload?.description?.trim() ||
      !payload?.reporterName?.trim()
    ) {
      return NextResponse.json(
        {
          message:
            "reporterName, title, description, category, and ward are required",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(payload.latitude) ||
      !Number.isFinite(payload.longitude)
    ) {
      return NextResponse.json(
        {
          message: "Location coordinates are required for pre-validation.",
        },
        { status: 400 },
      );
    }

    if (
      !complaintImageFile ||
      typeof complaintImageFile.arrayBuffer !== "function"
    ) {
      return NextResponse.json(
        { message: "Complaint image is required." },
        { status: 400 },
      );
    }

    if (
      complaintImageFile.type &&
      !String(complaintImageFile.type).startsWith("image/")
    ) {
      return NextResponse.json(
        { message: "Complaint image must be a valid image file." },
        { status: 400 },
      );
    }

    const rawStore = await readStore();
    const complaints = Array.isArray(rawStore?.complaints)
      ? rawStore.complaints
      : [];
    const logs = Array.isArray(rawStore?.logs) ? rawStore.logs : [];
    const store = {
      ...rawStore,
      complaints,
      logs,
    };

    if (
      Number.isFinite(payload.latitude) &&
      Number.isFinite(payload.longitude)
    ) {
      payload.location = {
        lat: payload.latitude,
        lng: payload.longitude,
      };
    }

    const savedImage = await saveImageFile(complaintImageFile, "complaint");
    const imageHash = await computeAverageHash(savedImage.buffer);

    payload.assignedTechnicianId = null;

    const complaint = generateComplaint(payload, {
      hash: imageHash,
      analyzerHash: null,
      path: savedImage.relativePath,
      reusedAcrossUsers: false,
    });

    const nextStore = {
      ...store,
      complaints: [complaint, ...store.complaints],
      logs: [
        `${complaint.id} reported with image evidence uploaded.`,
        `${complaint.id} pre-validation passed with user location (${payload.latitude.toFixed(5)}, ${payload.longitude.toFixed(5)}).`,
        `${complaint.id} awaiting authority review and technician assignment.`,
        `Complaint created: ${complaint.id} (${complaint.category}).`,
        ...store.logs,
      ].slice(0, 100),
    };

    await writeStore(nextStore);
    return NextResponse.json({
      store: nextStore,
      duplicateAttached: false,
    });
  } catch (error) {
    console.error("Complaint creation failed:", error);
    return NextResponse.json(
      {
        message: "Failed to create complaint.",
        error:
          process.env.NODE_ENV === "development"
            ? String(error?.message || error)
            : undefined,
      },
      { status: 500 },
    );
  }
}
