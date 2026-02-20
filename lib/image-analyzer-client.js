/**
 * Image Analyzer Client
 * Calls the Python image analysis service for duplicate detection,
 * fake problem detection, and before-after validation.
 */

const ANALYZER_URL = process.env.IMAGE_ANALYZER_URL || "http://localhost:5001";

export async function computePHash(imagePath) {
  try {
    const response = await fetch(`${ANALYZER_URL}/api/phash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_path: imagePath }),
    });

    if (!response.ok) throw new Error("Failed to compute pHash");
    const data = await response.json();
    return data.hash;
  } catch (error) {
    console.error("pHash computation error:", error.message);
    return null;
  }
}

export async function checkDuplicate(hash1, hash2, threshold = 5) {
  try {
    const response = await fetch(`${ANALYZER_URL}/api/duplicate-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash1, hash2, threshold }),
    });

    if (!response.ok) throw new Error("Failed to check duplicate");
    const data = await response.json();
    return data.is_duplicate;
  } catch (error) {
    console.error("Duplicate check error:", error.message);
    return false;
  }
}

export async function computeSSIM(imagePath1, imagePath2) {
  try {
    const response = await fetch(`${ANALYZER_URL}/api/ssim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image1_path: imagePath1,
        image2_path: imagePath2,
      }),
    });

    if (!response.ok) throw new Error("Failed to compute SSIM");
    const data = await response.json();
    return { score: data.ssim_score, isSimilar: data.is_similar };
  } catch (error) {
    console.error("SSIM computation error:", error.message);
    return { score: 0, isSimilar: false };
  }
}

export async function validateProblemExists(
  imagePath,
  complaintType = "Pothole",
) {
  try {
    const response = await fetch(`${ANALYZER_URL}/api/validate-problem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_path: imagePath,
        complaint_type: complaintType,
      }),
    });

    if (!response.ok) throw new Error("Failed to validate problem");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Problem validation error:", error.message);
    // Default to allowing if service is down
    return { valid: true, confidence: 0.5, reason: "Service unavailable" };
  }
}

export async function validateResolution(
  beforePath,
  afterPath,
  complaintType = "Pothole",
) {
  try {
    const response = await fetch(`${ANALYZER_URL}/api/validate-resolution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        before_image_path: beforePath,
        after_image_path: afterPath,
        complaint_type: complaintType,
      }),
    });

    if (!response.ok) throw new Error("Failed to validate resolution");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Resolution validation error:", error.message);
    // Default to allowing if service is down
    return { resolved: true, confidence: 0.5, reason: "Service unavailable" };
  }
}

export async function isAnalyzerReady() {
  try {
    const response = await fetch(`${ANALYZER_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
