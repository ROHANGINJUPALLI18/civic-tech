import { NextResponse } from "next/server";

import {
  computeAverageHash,
  hammingDistance,
  saveImageFile,
} from "@/lib/image-validation";
import { readStore, writeStore } from "@/lib/store";
import { runPreValidation } from "@/lib/workflow";

function mapDepartment(category) {
  if (category === "Pothole") return "Roads";
  if (category === "Garbage") return "Sanitation";
  if (category === "Streetlight") return "Utilities";
  if (category === "Sewage Overflow") return "Sewage";
  return "General";
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
    location: {
      lat: 28.6138 + Math.random() / 5000,
      lng: 77.209 + Math.random() / 5000,
    },
    ward: payload.ward,
    scanConfirmed: Boolean(payload.scanConfirmed),
    scanTimestamp: Boolean(payload.scanConfirmed) ? createdAt : null,
    createdAt,
    slaHours: payload.category === "Sewage Overflow" ? 12 : 24,
    imageHash: imageContext.hash,
    imagePath: imageContext.path,
    metadataValid: Boolean(payload.scanConfirmed),
    internetHashMatch: false,
    reusedImageAcrossUsers: imageContext.reusedAcrossUsers,
    communityWeight: 1,
    assignedTechnicianId: null,
    beforeEvidence: { objectDetected: true, ssim: 0.22 },
    afterEvidence: { objectDetected: false, ssim: 0.42 },
  };
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store.complaints);
}

export async function POST(request) {
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

  if (!payload?.scanConfirmed) {
    return NextResponse.json(
      {
        message:
          "Complaint scan required. Please scan/upload location + timestamp evidence before submit.",
      },
      { status: 400 },
    );
  }

  if (
    !complaintImageFile ||
    typeof complaintImageFile.arrayBuffer !== "function"
  ) {
    return NextResponse.json(
      { message: "Complaint image is required for AI validation." },
      { status: 400 },
    );
  }

  const store = await readStore();
  const savedImage = await saveImageFile(complaintImageFile, "complaint");
  const imageHash = await computeAverageHash(savedImage.buffer);

  const reusedAcrossUsers = store.complaints.some((item) => {
    if (!item.imageHash) return false;
    return hammingDistance(item.imageHash, imageHash) <= 8;
  });

  const complaint = generateComplaint(payload, {
    hash: imageHash,
    path: savedImage.relativePath,
    reusedAcrossUsers,
  });
  const preValidation = runPreValidation(complaint, store.complaints);

  if (preValidation.flaggedForHumanReview) {
    const nextStore = {
      ...store,
      complaints: [
        {
          ...complaint,
          state: "AI Pre-Validation",
          validationWarnings: preValidation.suspiciousSignals,
        },
        ...store.complaints,
      ],
      logs: [
        `Complaint ${complaint.id} submitted with validation warning: ${preValidation.suspiciousSignals.join(", ") || "manual review needed"}.`,
        ...store.logs,
      ].slice(0, 100),
    };

    await writeStore(nextStore);
    return NextResponse.json({
      store: nextStore,
      duplicateAttached: false,
      warning: true,
    });
  }

  if (preValidation.duplicate.isDuplicate && preValidation.duplicate.match) {
    const updatedComplaints = store.complaints.map((item) =>
      item.id === preValidation.duplicate.match.complaintId
        ? { ...item, communityWeight: item.communityWeight + 1 }
        : item,
    );

    const nextStore = {
      ...store,
      complaints: updatedComplaints,
      logs: [
        `Duplicate routed: ${complaint.id} attached to ${preValidation.duplicate.match.complaintId}.`,
        ...store.logs,
      ].slice(0, 100),
    };

    await writeStore(nextStore);
    return NextResponse.json({ store: nextStore, duplicateAttached: true });
  }

  const nextStore = {
    ...store,
    complaints: [complaint, ...store.complaints],
    logs: [
      `Complaint created: ${complaint.id} (${complaint.category}).`,
      ...store.logs,
    ].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json({ store: nextStore, duplicateAttached: false });
}
