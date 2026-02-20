import { NextResponse } from "next/server";
import path from "node:path";

import {
  computeSimilarityScore,
  estimateObjectPresence,
  readStoredImage,
  saveImageFile,
} from "@/lib/image-validation";
import { readStore, writeStore } from "@/lib/store";
import { runResolutionValidation } from "@/lib/workflow";
import { validateResolution } from "@/lib/image-analyzer-client";

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

  if (!payload?.proofCaptured) {
    const flaggedStore = {
      ...store,
      complaints: store.complaints.map((item) =>
        item.id === complaint.id ? { ...item, state: "Manager Review" } : item,
      ),
      logs: [
        `Fraud alert: ${complaint.id} completion rejected due to missing proof evidence.`,
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

  // AI validation: Check if issue was actually resolved
  const resolutionValidation = await validateResolution(
    complaint.imagePath
      ? path.join(process.cwd(), "data", complaint.imagePath)
      : "",
    savedAfterImage.absolutePath,
    complaint.category,
  );

  // If AI says issue is not resolved with high confidence
  const shouldFlagForReview =
    (!resolutionValidation.resolved && resolutionValidation.confidence > 0.7) ||
    objectStillDetected ||
    similarity > 0.75;

  const afterEvidence = {
    objectDetected: objectStillDetected,
    ssim: similarity,
    aiResolved: resolutionValidation.resolved,
    aiConfidence: resolutionValidation.confidence,
    aiReason: resolutionValidation.reason,
    imagePath: savedAfterImage.relativePath,
  };

  const validation = runResolutionValidation(
    complaint.beforeEvidence,
    afterEvidence,
  );
  const nextState =
    shouldFlagForReview || validation.requiresManagerReview
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
      nextState === "Manager Review"
        ? `Technician submission for ${complaint.id} flagged for manager review. AI: ${resolutionValidation.reason}`
        : `Technician submission for ${complaint.id} validated and marked completed.`,
      ...store.logs,
    ].slice(0, 100),
  };

  await writeStore(nextStore);
  return NextResponse.json(nextStore);
}
