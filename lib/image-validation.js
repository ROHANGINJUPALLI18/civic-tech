import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveImageFile(file, prefix = "img") {
  await ensureUploadDir();

  const extension =
    file?.name
      ?.split(".")
      .pop()
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]/g, "") || "jpg";
  const safeExtension = extension.length > 0 ? extension : "jpg";
  const fileName = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}.${safeExtension}`;
  const outputPath = path.join(UPLOAD_DIR, fileName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, bytes);

  return {
    absolutePath: outputPath,
    relativePath: path.join("uploads", fileName).replace(/\\/g, "/"),
    buffer: bytes,
  };
}

export async function readStoredImage(relativePath) {
  const absolutePath = path.join(process.cwd(), "data", relativePath);
  return readFile(absolutePath);
}

export async function computeAverageHash(imageBuffer) {
  const resized = await sharp(imageBuffer)
    .grayscale()
    .resize(16, 16, { fit: "fill" })
    .raw()
    .toBuffer();

  const mean = resized.reduce((sum, pixel) => sum + pixel, 0) / resized.length;
  return Array.from(resized)
    .map((pixel) => (pixel >= mean ? "1" : "0"))
    .join("");
}

export function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== hashB.length)
    return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let index = 0; index < hashA.length; index += 1) {
    if (hashA[index] !== hashB[index]) distance += 1;
  }
  return distance;
}

export async function computeSimilarityScore(beforeBuffer, afterBuffer) {
  const [a, b] = await Promise.all([
    sharp(beforeBuffer)
      .grayscale()
      .resize(128, 128, { fit: "fill" })
      .raw()
      .toBuffer(),
    sharp(afterBuffer)
      .grayscale()
      .resize(128, 128, { fit: "fill" })
      .raw()
      .toBuffer(),
  ]);

  let diffTotal = 0;
  for (let index = 0; index < a.length; index += 1) {
    diffTotal += Math.abs(a[index] - b[index]);
  }

  const maxDiff = a.length * 255;
  const normalized = 1 - diffTotal / maxDiff;
  return Math.max(0, Math.min(1, normalized));
}

export async function estimateObjectPresence(category, imageBuffer) {
  const pixels = await sharp(imageBuffer)
    .grayscale()
    .resize(128, 128, { fit: "fill" })
    .raw()
    .toBuffer();

  const darkPixels = pixels.filter((value) => value < 80).length;
  const brightPixels = pixels.filter((value) => value > 180).length;
  const darkRatio = darkPixels / pixels.length;
  const brightRatio = brightPixels / pixels.length;

  if (category === "Streetlight") {
    return brightRatio < 0.18;
  }

  if (category === "Garbage") {
    return darkRatio > 0.22;
  }

  if (category === "Sewage Overflow") {
    return darkRatio > 0.28;
  }

  return darkRatio > 0.2;
}
