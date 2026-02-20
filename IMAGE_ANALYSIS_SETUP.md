# Image Analysis & Validation System

This document explains how to set up and use the AI-powered image validation system for the Civic Complaint application.

## Overview

The system provides three levels of validation:

1. **Fake Problem Detection** – Verify the reported problem actually exists
2. **Duplicate Detection** – Identify same images from same location
3. **Before-After Validation** – Confirm technician actually fixed the issue

## Architecture

```
Civic App (Next.js)
    ↓
image-analyzer-client.js (Node.js wrapper)
    ↓
Python Flask Service (image_analyzer/app.py)
    ↓
AI Services:
  - Gemini Vision API (fake problem, resolution validation)
  - pHash (duplicate detection)
  - SSIM (similarity scoring)
  - OpenCV (object detection)
```

## Setup

### 1. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key

### 2. Install Python Dependencies

```bash
cd image_analyzer
python -m venv venv

# On Windows:
venv\Scripts\activate.bat

# On Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Set Environment Variables

Create `.env.local` in the project root:

```env
# Gemini API Key for image analysis
GEMINI_API_KEY=your-gemini-api-key-here

# Image Analyzer service URL (where Python service runs)
IMAGE_ANALYZER_URL=http://localhost:5000
```

### 4. Start the Python Image Analyzer Service

**Windows:**

```bash
cd image_analyzer
start.bat
```

**Linux/Mac:**

```bash
cd image_analyzer
chmod +x start.sh
./start.sh
```

The service will start on `http://localhost:5000` and should show:

```
Starting Image Analyzer Service on http://0.0.0.0:5000
 * Running on http://0.0.0.0:5000
```

### 5. Start Node.js App

In a separate terminal:

```bash
npm run dev
```

## How It Works

### Phase 1: User Submits Complaint

When a user submits a photo of a problem:

1. **Fake Problem Detection**
   - Image is sent to Gemini Vision API
   - Model analyzes: "Does a {Pothole/Drainage/etc} actually exist?"
   - If confidence > 70% that problem doesn't exist → flagged for review

2. **Duplicate Detection**
   - Compute perceptual hash (pHash) of image
   - Check if similar image from same location
   - If hamming distance < 5 → merged with existing complaint

**Result:** Complaint created with status "Reported" or "AI Pre-Validation" (if flagged)

### Phase 2: Technician Submits Completion

When technician uploads proof of work:

1. **SSIM Check** (Structural Similarity)
   - Compare before-image vs after-image
   - If similarity > 0.8 → possible fake completion

2. **AI Resolution Validation**
   - Send both images to Gemini Vision
   - Ask: "Was the problem actually resolved?"
   - If confidence > 70% that NOT resolved → flagged

3. **Object Detection**
   - Check if the problem object still exists
   - If yes → flag for human review

**Result:** Complaint marked "Completed" or moved to "Manager Review"

### Phase 3: Admin Reviews Flow

Admins can see:

- AI confidence scores
- Reasons why items were flagged
- Manual override capability
- Technician trust score impact

## API Endpoints (Python Service)

### Health Check

```
GET /health
```

### Compute Perceptual Hash

```
POST /api/phash
{
  "image_path": "/path/to/image.jpg"
}
```

### Check Duplicate

```
POST /api/duplicate-check
{
  "hash1": "abc123...",
  "hash2": "def456...",
  "threshold": 5
}
```

### Compute SSIM Score

```
POST /api/ssim
{
  "image1_path": "/path/before.jpg",
  "image2_path": "/path/after.jpg"
}
```

### Validate Problem Exists

```
POST /api/validate-problem
{
  "image_path": "/path/to/image.jpg",
  "complaint_type": "Pothole"
}
```

### Validate Issue Resolution

```
POST /api/validate-resolution
{
  "before_image_path": "/path/before.jpg",
  "after_image_path": "/path/after.jpg",
  "complaint_type": "Pothole"
}
```

## Integration Points

### Complaint Creation (`app/api/complaints/route.js`)

```javascript
const problemValidation = await validateProblemExists(imagePath, complaintType);

if (!problemValidation.valid && problemValidation.confidence > 0.7) {
  // Flag for manual review
}
```

### Technician Submission (`app/api/complaints/[id]/technician-submit/route.js`)

```javascript
const resolutionValidation = await validateResolution(
  beforeImagePath,
  afterImagePath,
  complaintType,
);

if (!resolutionValidation.resolved && confidence > 0.7) {
  // Move to Manager Review
}
```

## Testing

### Test Fake Problem Detection

Submit a complaint with:

- Category: "Pothole"
- Image: A clean road (no pothole)
- Expected: Flagged in "AI Pre-Validation"

### Test Before-After Validation

1. Create complaint with pothole image
2. As technician, upload same image again as "after" work
3. Expected: Flagged due to high SSIM (no actual work done)

### Test Duplicate Detection

1. Submit complaint from "Ward 12" with an image
2. Submit same image from "Ward 12" again
3. Expected: Merged with first complaint (increases community weight)

## Troubleshooting

### "IMAGE_ANALYZER_URL not found"

- Python service not running
- Start it with `cd image_analyzer && start.bat` (Windows) or `./start.sh` (Linux)

### "GEMINI_API_KEY not configured"

- AI validation disabled
- Set `GEMINI_API_KEY` in `.env.local`
- Restart Node.js app

### "Failed to access camera"

- Browser permission denied
- Check camera permissions in browser settings
- Allow HTTPS or localhost access

### Python service crashes

- Install missing dependencies: `pip install -r requirements.txt`
- Check if port 5000 is already in use: `lsof -i :5000` (Linux) or `netstat -ano | find 5000` (Windows)

## Performance Notes

- **pHash computation:** ~50-100ms per image
- **SSIM comparison:** ~100-200ms per pair
- **Gemini Vision API call:** ~1-3 seconds (includes network latency)
- **Total complaint creation time:** ~3-5 seconds (mostly API latency)

## Cost Considerations

- **Gemini API:** Free tier available (~60 API calls/minute)
- **Python service:** Local, no cost
- **Storage:** Stored images count toward your filesystem quota

## Future Enhancements

1. **Real-time object detection** – YOLO integration for faster local analysis
2. **CLIP embeddings** – Better semantic understanding of issue types
3. **Caching** – Store pHash results for faster duplicate detection
4. **Batch processing** – Queue images for off-peak analysis
5. **Custom models** – Train models on local complaint data

## Support

For issues or questions:

1. Check logs in Python service terminal
2. Enable debug mode in Flask: `export FLASK_DEBUG=1`
3. Check Node.js terminal for API errors
4. Verify `.env.local` has correct API keys
