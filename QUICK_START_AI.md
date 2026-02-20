# Quick Start: AI Image Validation

This guide will get you up and running with the image validation system in 5 minutes.

## Step 1: Get Gemini API Key (2 min)

1. Open https://aistudio.google.com/app/apikey
2. Click **"Create API Key"** button
3. Copy the key
4. Paste it in `.env.local`:

```env
GEMINI_API_KEY=paste-your-key-here
IMAGE_ANALYZER_URL=http://localhost:5000
```

## Step 2: Install Python (1 min)

If Python isn't installed, download from https://python.org

Verify installation:

```bash
python --version
```

## Step 3: Start Image Analyzer Service (1 min)

**Windows:**

```bash
cd image_analyzer
start.bat
```

**Mac/Linux:**

```bash
cd image_analyzer
chmod +x start.sh
./start.sh
```

You should see:

```
Starting Image Analyzer Service on http://0.0.0.0:5000
 * Running on http://0.0.0.0:5000
```

⚠️ **Keep this terminal open** — don't close it.

## Step 4: Start Node.js App (1 min)

In a **new terminal** (leave the Python one running):

```bash
npm run dev
```

Visit: http://localhost:3000

## That's It! 🎉

### Try it Out:

**Test Fake Problem Detection:**

1. Go to User Dashboard
2. Submit complaint "Pothole" with image of a **clean road** (no damage)
3. AI should flag it in "AI Pre-Validation"

**Test Before-After Validation:**

1. Create complaint with pothole image
2. As technician, upload the **same image** as "after" work
3. System flags it (high SSIM = no actual work done)

## Troubleshooting

| Problem                                             | Solution                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| "Module not found: `google.generativeai`" in Python | Run: `pip install -r requirements.txt` in `image_analyzer` folder |
| "GEMINI_API_KEY not configured"                     | Add `GEMINI_API_KEY=xxx` to `.env.local`                          |
| Python service won't start                          | Check if port 5000 is in use: `lsof -i :5000` (Mac/Linux)         |
| "Failed to validate problem" in logs                | Python service not running or API key invalid                     |

## What Each AI Check Does

### ✅ Fake Problem Detection

- **When:** User submits complaint
- **What:** Checks if problem actually exists in image
- **Result:** Approval or "AI Pre-Validation" flag

### ✅ Duplicate Detection

- **When:** User submits complaint
- **What:** Compares image hash to others from same ward
- **Result:** Merges duplicates or creates new complaint

### ✅ Before-After Validation

- **When:** Technician submits completion
- **What:** Checks if issue was actually resolved
- **Result:** "Completed" or moved to "Manager Review"

## Disable AI (Optional)

If you want to run without AI validation while testing:

1. In `lib/image-analyzer-client.js`, wrap functions to return defaults:

```javascript
export async function validateProblemExists() {
  return { valid: true, confidence: 1.0, reason: "Disabled" };
}
```

2. In `.env.local`:

```env
ENABLE_AI_VALIDATION=false
```

## Tweaking Sensitivity

Edit thresholds in `.env.local`:

```env
# 0.5 = lenient, 0.9 = strict
FAKE_PROBLEM_THRESHOLD=0.7

# How similar before/after must be to flag (0-1)
SSIM_THRESHOLD=0.75

# How different image hashes before duplicate (0-64)
PHASH_THRESHOLD=5
```

## Cost

- **Python service:** Free (runs locally)
- **Gemini API:** Free tier ~60 API calls/min
- **Storage:** Your disk space

The free Gemini API is enough for testing and small deployments.

## Need Help?

Check the full docs in `IMAGE_ANALYSIS_SETUP.md`

Or check the Python service logs for detailed errors.
