import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const DATA_DIR = path.join(process.cwd(), "data");

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_, { params }) {
  const { slug } = await params;
  const parts = Array.isArray(slug) ? slug : [];

  if (!parts.length) {
    return NextResponse.json(
      { message: "Image path required" },
      { status: 400 },
    );
  }

  const candidatePath = path.resolve(DATA_DIR, ...parts);
  const normalizedDataDir = path.resolve(DATA_DIR) + path.sep;

  if (!candidatePath.startsWith(normalizedDataDir)) {
    return NextResponse.json(
      { message: "Invalid image path" },
      { status: 400 },
    );
  }

  try {
    const file = await readFile(candidatePath);
    const extension = path.extname(candidatePath).toLowerCase();
    const contentType = MIME_BY_EXT[extension] || "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
}
