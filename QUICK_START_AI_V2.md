# 🚀 AI Image Validation - Quick Setup (5 Minutes)

## Step 1: Get Gemini API Key (2 min)

```bash
# 1. Go to: https://aistudio.google.com/app/apikeys
# 2. Click "Create API Key"
# 3. Copy the key
```

## Step 2: Configure Environment (1 min)

```bash
# In the civic-tech/civic directory:
cp .env.local.example .env.local

# Edit .env.local and add your key:
GEMINI_API_KEY=your_copied_key_here
```

## Step 3: Start Python Service (1 min)

```bash
# Open a NEW terminal window INSIDE civic-tech/civic

cd image_analyzer

# Windows (PowerShell/CMD):
python app.py
# or
start.bat

# macOS/Linux:
./start.sh
```

**You should see:**

```
 * Running on http://localhost:5001
 * Press CTRL+C to quit
```

## Step 4: Test the Service (1 min)

```bash
# In your existing terminal, test health:
curl http://localhost:5001/health

# Should see:
# {"status": "healthy", "models_loaded": true}
```

---

## 🎯 Test the Full Workflow

### Test 1: Submit a Suspicious Complaint

```
1. Open http://localhost:3000/user
2. Login: user / demo123
3. Submit a complaint with a CLEAN road photo (or sky)
4. Expected: Flagged to "AI Pre-Validation" (AI thinks it's fake)
5. Go to Admin dashboard, see it in "Pending Review"
```

### Test 2: Duplicate Detection

```
1. Submit complaint #1 with Photo A
2. Submit complaint #2 from same location with Photo A
3. Expected: "Duplicate detected" warning
```

### Test 3: Work Validation

```
1. Create complaint as user
2. Assign to technician
3. Technician submits identical before/after photos
4. Expected: Flagged to "Manager Review" (no work done)
```

---

## 📁 What Was Added

| File                                                 | Purpose                                |
| ---------------------------------------------------- | -------------------------------------- |
| `image_analyzer/app.py`                              | Python Flask service with AI pipelines |
| `image_analyzer/requirements.txt`                    | Python dependencies                    |
| `lib/image-analyzer-client.js`                       | Node.js client wrapper                 |
| `app/api/complaints/route.js`                        | Enhanced with fake problem detection   |
| `app/api/complaints/[id]/technician-submit/route.js` | Enhanced with resolution validation    |
| `IMAGE_ANALYSIS_SETUP.md`                            | Full documentation                     |
| `.env.local.example`                                 | Configuration template                 |
| `AI_INTEGRATION_STATUS.md`                           | Current status and troubleshooting     |

---

## 🔧 If Something Goes Wrong

### "Cannot find Python"

```bash
# Make sure Python is installed:
python --version

# Should show Python 3.8 or higher
```

### "Required module not found"

```bash
cd image_analyzer
pip install -r requirements.txt
python app.py
```

### "API key invalid" or "Quota exceeded"

```bash
# Check your API key is correct
# Go to: https://aistudio.google.com/app/apikeys
# Make sure it's enabled and has quota
```

### "Port 5001 already in use"

```bash
# Kill the existing process or use a different port
# Edit image_analyzer/app.py and change:
# app.run(port=5002, debug=True)
# Then update .env.local:
# IMAGE_ANALYZER_URL=http://localhost:5002
```

---

## ✅ You're Done!

Your civic complaint app now has:

- ✅ Automatic fake problem detection
- ✅ Duplicate submission prevention
- ✅ Resolution validation (is work actually done?)
- ✅ AI-powered confidence scoring
- ✅ Manager review workflows for suspicious submissions

**Next Steps:**

- Test with the 3 scenarios above
- Adjust thresholds in `.env.local` if needed:
  - `FAKE_PROBLEM_THRESHOLD` (default: 0.7)
  - `SSIM_THRESHOLD` (default: 0.75)
  - `PHASH_THRESHOLD` (default: 5)
- Monitor costs at https://aistudio.google.com/app/apikeys

---

## 📚 Learn More

See **IMAGE_ANALYSIS_SETUP.md** for:

- Complete API documentation
- System architecture diagram
- Configuration reference
- Troubleshooting guide
- Cost considerations
