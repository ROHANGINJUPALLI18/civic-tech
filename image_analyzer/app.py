"""
Image Analysis Service for Civic Complaints
- Perceptual hashing (pHash) for duplicate detection
- SSIM for before-after validation
- Gemini Vision API for object detection and fake problem detection
"""

import os
import base64
import numpy as np
from PIL import Image
from io import BytesIO
import google.generativeai as genai
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Complaint type to expected objects mapping
COMPLAINT_TYPES = {
    "Pothole": ["pothole", "hole in road", "asphalt hole", "pavement damage"],
    "Garbage": ["garbage", "trash", "litter", "waste", "dumping"],
    "Streetlight": ["streetlight", "light pole", "lamp post", "street lamp", "light fixture"],
    "Drainage": ["drainage", "drain", "clogged drain", "blocked drain", "water pooling", "stagnant water"],
    "Sewage Overflow": ["sewage", "sewer", "manhole", "overflow", "sewage backup"],
}


def load_image_from_base64(image_base64: str) -> Image.Image:
    """Load image from base64 string."""
    try:
        image_data = base64.b64decode(image_base64)
        return Image.open(BytesIO(image_data))
    except Exception as e:
        raise ValueError(f"Failed to decode image: {str(e)}")


def load_image_from_file(file_path: str) -> Image.Image:
    """Load image from file path."""
    return Image.open(file_path)


def compute_phash(image: Image.Image) -> str:
    """Compute a lightweight perceptual hash (average hash) of image."""
    grayscale = image.convert("L").resize((8, 8), Image.Resampling.LANCZOS)
    pixels = np.asarray(grayscale, dtype=np.float32)
    mean_value = float(pixels.mean())
    bits = (pixels > mean_value).astype(np.uint8).flatten()
    return "".join(f"{int(bit):x}" for bit in bits)


def hamming_distance(hash1: str, hash2: str) -> int:
    """Compute Hamming distance between two hashes."""
    return sum(c1 != c2 for c1, c2 in zip(hash1, hash2))


def compute_ssim(image1: Image.Image, image2: Image.Image) -> float:
    """Compute a lightweight similarity score (1 - normalized MSE) between two images."""
    try:
        img1 = np.asarray(image1.convert("L"), dtype=np.float32)
        target_size = (img1.shape[1], img1.shape[0])
        resized_img2 = image2.convert("L").resize(target_size, Image.Resampling.LANCZOS)
        img2 = np.asarray(resized_img2, dtype=np.float32)

        mse = float(np.mean((img1 - img2) ** 2))
        normalized_mse = mse / (255.0 ** 2)
        similarity = max(0.0, min(1.0, 1.0 - normalized_mse))
        return similarity
    except Exception as e:
        return 0.0


def validate_problem_exists(image_path_or_base64: str, complaint_type: str) -> dict:
    """
    Use Gemini Vision API to validate if the reported problem actually exists.
    Returns confidence score and reasoning.
    """
    if not GEMINI_API_KEY:
        return {"valid": True, "confidence": 0.5, "reason": "API key not configured"}

    try:
        # Load image
        if image_path_or_base64.startswith("data:image") or len(image_path_or_base64) > 500:
            image = load_image_from_base64(image_path_or_base64.split(",")[1] if "," in image_path_or_base64 else image_path_or_base64)
        else:
            image = load_image_from_file(image_path_or_base64)

        # Convert to base64 for API
        buffered = BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.standard_b64encode(buffered.getvalue()).decode()

        # Query Gemini
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(
            [
                {
                    "mime_type": "image/jpeg",
                    "data": img_base64,
                },
                f"Analyze this image. Does it show an actual {complaint_type} problem? "
                f"Be specific: is there visible damage, obstruction, or issue? "
                f"Respond with JSON: {{'has_problem': true/false, 'confidence': 0.0-1.0, 'details': 'brief description'}}",
            ]
        )

        # Parse response
        import json
        try:
            result = json.loads(response.text)
            return {
                "valid": result.get("has_problem", False),
                "confidence": result.get("confidence", 0.5),
                "reason": result.get("details", ""),
            }
        except:
            return {"valid": True, "confidence": 0.5, "reason": "Could not parse AI response"}

    except Exception as e:
        return {"valid": True, "confidence": 0.5, "reason": f"Analysis error: {str(e)}"}


def validate_issue_resolved(before_image_path: str, after_image_path: str, complaint_type: str) -> dict:
    """
    Validate if the issue was actually resolved by comparing before/after images
    and using Gemini Vision to analyze if the problem is still present.
    """
    if not GEMINI_API_KEY:
        return {"resolved": True, "confidence": 0.5, "reason": "API key not configured"}

    try:
        # Load images
        before_img = load_image_from_file(before_image_path)
        after_img = load_image_from_file(after_image_path)

        # Compute SSIM - if images are too similar, suspicious
        similarity = compute_ssim(before_img, after_img)
        if similarity > 0.8:
            return {
                "resolved": False,
                "confidence": 0.95,
                "reason": "Before and after images are too similar (possible fake completion). SSIM score: {:.2f}".format(similarity),
                "ssim_score": similarity,
            }

        # Convert both to base64
        def img_to_base64(img):
            buffered = BytesIO()
            img.save(buffered, format="JPEG")
            return base64.standard_b64encode(buffered.getvalue()).decode()

        before_b64 = img_to_base64(before_img)
        after_b64 = img_to_base64(after_img)

        # Query Gemini with both images
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(
            [
                "First image (BEFORE):",
                {"mime_type": "image/jpeg", "data": before_b64},
                "Second image (AFTER):",
                {"mime_type": "image/jpeg", "data": after_b64},
                f"Was the {complaint_type} problem actually resolved? "
                f"Compare the two images carefully. Respond with JSON: {{'resolved': true/false, 'confidence': 0.0-1.0, 'reason': 'brief explanation'}}",
            ]
        )

        import json
        try:
            result = json.loads(response.text)
            return {
                "resolved": result.get("resolved", True),
                "confidence": result.get("confidence", 0.5),
                "reason": result.get("reason", ""),
                "ssim_score": similarity,
            }
        except:
            return {"resolved": True, "confidence": 0.5, "reason": "Could not parse AI response", "ssim_score": similarity}

    except Exception as e:
        return {"resolved": True, "confidence": 0.5, "reason": f"Analysis error: {str(e)}"}


# Flask Routes
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "image-analysis"})


@app.route("/api/phash", methods=["POST"])
def phash():
    """Compute perceptual hash of an image."""
    try:
        data = request.json
        image_path = data.get("image_path")

        if not image_path:
            return jsonify({"error": "image_path required"}), 400

        image = load_image_from_file(image_path)
        hash_value = compute_phash(image)

        return jsonify({"hash": hash_value})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/duplicate-check", methods=["POST"])
def duplicate_check():
    """Check if image is a duplicate by comparing hashes."""
    try:
        data = request.json
        hash1 = data.get("hash1")
        hash2 = data.get("hash2")
        threshold = data.get("threshold", 5)  # Hamming distance threshold

        if not hash1 or not hash2:
            return jsonify({"error": "hash1 and hash2 required"}), 400

        distance = hamming_distance(hash1, hash2)
        is_duplicate = distance <= threshold

        return jsonify({
            "is_duplicate": is_duplicate,
            "hamming_distance": distance,
            "threshold": threshold,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ssim", methods=["POST"])
def compute_ssim_endpoint():
    """Compute SSIM between two images."""
    try:
        data = request.json
        image1_path = data.get("image1_path")
        image2_path = data.get("image2_path")

        if not image1_path or not image2_path:
            return jsonify({"error": "image1_path and image2_path required"}), 400

        image1 = load_image_from_file(image1_path)
        image2 = load_image_from_file(image2_path)

        similarity = compute_ssim(image1, image2)

        return jsonify({
            "ssim_score": similarity,
            "is_similar": similarity > 0.7,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/validate-problem", methods=["POST"])
def validate_problem():
    """Validate if a reported problem actually exists in the image."""
    try:
        data = request.json
        image_path = data.get("image_path")
        complaint_type = data.get("complaint_type", "Pothole")

        if not image_path:
            return jsonify({"error": "image_path required"}), 400

        result = validate_problem_exists(image_path, complaint_type)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/validate-resolution", methods=["POST"])
def validate_resolution():
    """Validate if a reported issue was actually resolved."""
    try:
        data = request.json
        before_image_path = data.get("before_image_path")
        after_image_path = data.get("after_image_path")
        complaint_type = data.get("complaint_type", "Pothole")

        if not before_image_path or not after_image_path:
            return jsonify({
                "error": "before_image_path and after_image_path required",
            }), 400

        result = validate_issue_resolved(before_image_path, after_image_path, complaint_type)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("IMAGE_ANALYZER_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
