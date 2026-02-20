import { NextResponse } from "next/server";

import {
  computeSimilarityScore,
  estimateObjectPresence,
  readStoredImage,
  saveImageFile,
} from "@/lib/image-validation";
import { readStore, writeStore } from "@/lib/store";
import { runResolutionValidation } from "@/lib/workflow";

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

  if (!["In Progress", "Work Uploaded", "Assigned"].includes(complaint.state)) {
    return NextResponse.json(
      {
        message: "Complaint is not ready for technician completion submission",
      },
      { status: 400 },
    );
  }

  if (!payload?.proofCaptured || !payload?.scanConfirmed) {
    const flaggedStore = {
      ...store,
      complaints: store.complaints.map((item) =>
        item.id === complaint.id ? { ...item, state: "Manager Review" } : item,
      ),
      logs: [
        `Fraud alert: ${complaint.id} completion rejected due to missing proof/scan evidence.`,
        ...store.logs,
      ].slice(0, 100),
    };

    await writeStore(flaggedStore);
    return NextResponse.json(flaggedStore);
  }

  if (!afterImageFile || typeof afterImageFile.arrayBuffer !== "function") {
    return NextResponse.json(
      { message: "After-work image is required for resolution validation" },
      { status: 400 },
    );
  }

  if (!complaint.imagePath) {
    return NextResponse.json(
      { message: "Complaint does not have a baseline image for comparison" },
      { status: 400 },
    );
  }

  const savedAfterImage = await saveImageFile(afterImageFile, "after-work");
  const beforeBuffer = await readStoredImage(complaint.imagePath);
  const similarity = await computeSimilarityScore(
    beforeBuffer,
    savedAfterImage.buffer,
  );
  const objectStillDetected = await estimateObjectPresence(
    complaint.category,
    savedAfterImage.buffer,
  );

  const afterEvidence = {
    objectDetected: objectStillDetected,
    ssim: similarity,
    imagePath: savedAfterImage.relativePath,
  };

  const validation = runResolutionValidation(
    complaint.beforeEvidence,
    afterEvidence,
  );
  const nextState = validation.requiresManagerReview
    ? "Manager Review"
    : "Completed";

  const nextStore = {
    ...store,
    complaints: store.complaints.map((item) =>
      item.id === complaint.id
        ? {
            ...item,
            state: nextState,
            afterEvidence,
            technicianSubmission: {
              submittedAt: new Date().toISOString(),
              proofCaptured: true,
              scanConfirmed: true,
            },
          }
        : item,
    ),
    logs: [
      validation.requiresManagerReview
        ? `Technician submission for ${complaint.id} flagged for manager review.`
        : `Technician submission for ${complaint.id} validated and marked completed.`,
      ...store.logs,
    ].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json(nextStore);
}
