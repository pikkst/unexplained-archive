# AI Tools Testing Guide
## Comprehensive Testing Manual for Investigator AI Tools

---

## 🎯 Overview

This guide provides detailed testing procedures for all AI-powered investigator tools integrated into the Unexplained Archive platform.

**AI Tools Available:**
1. Image Analysis (Gemini Vision API)
2. Text Analysis (Gemini Text API)
3. Similar Cases Search
4. Report Generation
5. Timeline Extraction
6. Image Authenticity Verification

---

## 📋 Pre-Test Checklist

### Required Setup:
- [ ] Gemini API key configured in `.env` as `VITE_GEMINI_API_KEY`
- [ ] Supabase connected and accessible
- [ ] At least 3-5 test cases created in database
- [ ] Test images uploaded to Supabase Storage
- [ ] User logged in with Investigator role
- [ ] Browser console open for monitoring

### Test Environment:
```bash
# Verify environment variables
echo $VITE_GEMINI_API_KEY  # Should not be empty

# Check Supabase connection
# Navigate to app and check browser console for Supabase init messages

# Verify Gemini API works
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"
```

---

## 🧪 Testing Procedures

### Test 1: Image Analysis
**Tool:** AI Image Analysis  
**API:** Gemini Vision (`gemini-1.5-flash`)  
**Location:** Investigator Dashboard → My Cases → [Case] → AI Tools → Image Analysis

#### Steps:
1. Navigate to Investigator Dashboard
2. Click on a case with an image
3. Click "AI Tools" button
4. Select "Image Analysis"
5. Wait for AI processing (15-30 seconds)

#### Expected Results:
✅ **Success Criteria:**
- Confidence score displayed (0-100%)
- At least 1 detected object listed
- Anomalies section shown (may be empty)
- Key findings list (minimum 3 items)
- Lighting/quality assessment provided
- Full AI analysis text visible

❌ **Failure Cases:**
- "Image analysis failed" error
- No detected objects
- Confidence score <10%
- Empty analysis text
- Timeout (>60 seconds)

#### Test Data:
```typescript
// Sample test case
{
  title: "Strange Lights Over City",
  description: "Bright geometric lights moving in formation",
  media_url: "https://example.com/ufo-image.jpg", // Use real image URL
  category: "UFO"
}
```

#### Manual Verification:
```javascript
// Run in browser console
aiTests.testImageAnalysis();
```

---

### Test 2: Text Analysis
**Tool:** AI Text Analysis  
**API:** Gemini Text (`gemini-1.5-flash`)  
**Location:** AI Tools → Text Analysis

#### Steps:
1. Open AI Tools panel
2. Select "Text Analysis"
3. Wait for processing

#### Expected Results:
✅ **Success Criteria:**
- Sentiment detected: positive/negative/neutral
- Keywords extracted (minimum 3)
- Entities identified (people, places, times)
- Confidence score >40%
- Suggested actions provided

❌ **Failure Cases:**
- Invalid sentiment value
- No keywords extracted
- Confidence <20%
- Analysis text is generic/unhelpful

#### Test Cases:
```javascript
// Test Case 1: Clear UFO sighting
const testText1 = "I saw three bright lights moving in a triangle formation over Lake Michigan at 11:30 PM on October 15th, 2024. The lights were silent and moved against the wind.";

// Test Case 2: Ambiguous paranormal event
const testText2 = "Strange noises in the old house. Maybe ghosts? Not sure what it was.";

// Test Case 3: Detailed cryptid encounter
const testText3 = "Large bipedal creature, approximately 7-8 feet tall, covered in dark fur. Encountered in Pacific Northwest forest near Highway 101 around dawn on March 3rd. Witness: John Smith.";
```

#### Manual Verification:
```javascript
aiTests.testTextAnalysis();
```

---

### Test 3: Similar Cases Search
**Tool:** Similar Cases Finder  
**API:** Supabase Database  
**Location:** AI Tools → Similar Cases

#### Steps:
1. Open AI Tools for a case
2. Click "Similar Cases"
3. Review results

#### Expected Results:
✅ **Success Criteria:**
- Returns 0-5 similar cases
- Cases have same category
- Cases are different from current case
- Each case shows: title, category, status, date
- Results sorted by relevance

❌ **Failure Cases:**
- Returns current case in results
- Returns cases from different categories
- Returns >5 cases
- Empty results for common categories

#### Test Scenarios:
| Case Category | Expected Similar | Notes |
|--------------|------------------|-------|
| UFO | 2-5 UFO cases | Largest category |
| Cryptid | 1-3 Cryptid cases | Medium category |
| Paranormal | 2-4 Paranormal | Common category |
| Unique/New | 0 cases | Edge case |

#### Manual Verification:
```javascript
aiTests.testSimilarCases();
```

---

### Test 4: Report Generation
**Tool:** AI Report Generator  
**API:** Gemini Text  
**Location:** AI Tools → Generate Report

#### Steps:
1. Select a case with multiple comments
2. Open AI Tools
3. Click "Generate Report"
4. Wait for generation (20-40 seconds)

#### Expected Results:
✅ **Success Criteria:**
- Report >500 characters
- Contains sections:
  - Executive Summary
  - Key Evidence
  - Timeline of Events
  - Analysis & Findings
  - Conclusion
  - Recommended Next Steps
- Professional formatting
- References case details accurately
- Includes witness comments

❌ **Failure Cases:**
- Report <100 characters
- Missing key sections
- Generic/template text
- Factual errors
- No witness comments included

#### Report Quality Checklist:
- [ ] Executive summary captures main points
- [ ] Evidence section lists specific details
- [ ] Timeline is chronological
- [ ] Analysis provides insights (not just description)
- [ ] Conclusion is logical
- [ ] Next steps are actionable

#### Manual Verification:
```javascript
aiTests.testReportGeneration();
```

---

### Test 5: Timeline Extraction
**Tool:** AI Timeline Extractor  
**API:** Gemini Text  
**Location:** AI Tools → Timeline Extraction

#### Steps:
1. Select case with temporal references
2. Open AI Tools
3. Click "Timeline Extraction"

#### Expected Results:
✅ **Success Criteria:**
- Minimum 1 event extracted
- Events have time + description
- Events in chronological order
- Includes incident date
- May include comment timestamps

❌ **Failure Cases:**
- Empty timeline
- Events out of order
- Missing incident date
- Duplicate events

#### Test Data:
```javascript
// Good test case (should extract 4 events)
const timelineCase = {
  description: "At 10:00 PM I heard noises. At 10:15 PM I saw the creature. At 10:30 PM it ran away. Police arrived at 11:00 PM.",
  incident_date: "2024-10-15T22:00:00Z"
};
```

#### Manual Verification:
```javascript
aiTests.testTimelineExtraction();
```

---

### Test 6: Image Authenticity Verification
**Tool:** AI Authenticity Checker  
**API:** Gemini Vision  
**Location:** AI Tools → Verify Authenticity

#### Steps:
1. Select case with image
2. Open AI Tools
3. Click "Verify Authenticity"
4. Wait for analysis

#### Expected Results:
✅ **Success Criteria:**
- Authentic boolean: true/false
- Confidence score (0-100%)
- Issues array (may be empty)
- Detailed analysis text
- Checks for:
  - Compression artifacts
  - Lighting inconsistencies
  - Edge artifacts
  - Clone stamp patterns

❌ **Failure Cases:**
- Always returns "authentic: true" (not analyzing)
- Confidence score always 50% (not working)
- Empty issues array for obviously fake images
- Analysis is generic

#### Test Images:
1. **Real Photo**: Nature photo from phone camera
   - Expected: authentic: true, confidence: 70-95%
2. **Heavily Edited**: Photoshopped composite
   - Expected: authentic: false, confidence: 60-90%, issues detected
3. **Screenshot**: Screenshot of another image
   - Expected: authentic: false or low confidence, compression artifacts noted

#### Manual Verification:
```javascript
aiTests.testImageAuthenticity();
```

---

## 🔄 Integration Testing

### Full Investigation Workflow Test
**Scenario:** Complete case analysis from start to finish

#### Steps:
1. Create new test case with all data
2. Run Image Analysis
3. Run Text Analysis
4. Find Similar Cases
5. Extract Timeline
6. Verify Image Authenticity
7. Generate Final Report

#### Expected Flow Time:
- Total: 2-4 minutes
- Each tool: 15-45 seconds

#### Success Criteria:
- All 6 tools complete successfully
- No errors or timeouts
- Report incorporates findings from other tools
- UI remains responsive

#### Run Full Workflow Test:
```javascript
const results = await aiTests.testFullInvestigationWorkflow();
console.log(results);
```

---

## 📊 Performance Testing

### Response Time Benchmarks
| Tool | Target Time | Maximum Time | Status |
|------|-------------|--------------|--------|
| Image Analysis | <30s | 60s | ⏱️ |
| Text Analysis | <15s | 30s | ⏱️ |
| Similar Cases | <5s | 10s | ⏱️ |
| Report Generation | <25s | 60s | ⏱️ |
| Timeline Extraction | <20s | 45s | ⏱️ |
| Authenticity Check | <30s | 60s | ⏱️ |

### Performance Test:
```javascript
// Test response time for each tool
await aiTests.testResponseTime(aiTests.testImageAnalysis, 'Image Analysis');
await aiTests.testResponseTime(aiTests.testTextAnalysis, 'Text Analysis');
await aiTests.testResponseTime(aiTests.testSimilarCases, 'Similar Cases');
```

---

## 🚨 Error Handling Tests

### Error Scenarios to Test:

#### 1. Invalid Image URL
```javascript
// Should fail gracefully
await aiToolsService.analyzeImage('https://invalid-url.com/fake.jpg');
// Expected: Error caught, user-friendly message shown
```

#### 2. Empty Text Input
```javascript
await aiToolsService.analyzeText('', 'case');
// Expected: Handles gracefully or shows validation error
```

#### 3. Non-existent Case ID
```javascript
await aiToolsService.generateReport('00000000-0000-0000-0000-000000000000');
// Expected: "Case not found" error
```

#### 4. API Key Missing
```javascript
// Remove VITE_GEMINI_API_KEY from .env
// Expected: Clear error message about missing API key
```

#### 5. Network Timeout
```javascript
// Simulate slow network in DevTools (Slow 3G)
// Expected: Timeout after 60s, error message shown
```

### Run Error Tests:
```javascript
const errorResults = await aiTests.testErrorHandling();
console.log(errorResults);
```

---

## 🎓 Testing Best Practices

### 1. Test Data Management
- Create dedicated test cases (prefix with "TEST:")
- Use variety of categories (UFO, Cryptid, Paranormal)
- Include cases with/without images
- Add cases with multiple comments
- Clean up test data after testing

### 2. Browser Console Monitoring
```javascript
// Enable verbose logging
localStorage.setItem('DEBUG_AI_TOOLS', 'true');

// Watch for errors
window.addEventListener('error', (e) => {
  console.error('Global error:', e);
});
```

### 3. Network Tab Analysis
- Monitor API calls to Gemini
- Check response times
- Verify payload sizes
- Look for rate limiting (429 errors)

### 4. Database Verification
```sql
-- Check AI usage tracking
SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT 10;

-- Verify case data
SELECT id, title, media_url FROM cases WHERE media_url IS NOT NULL;
```

---

## 📝 Test Results Template

```markdown
## AI Tools Test Report
**Date:** YYYY-MM-DD  
**Tester:** [Name]  
**Environment:** Production / Staging / Local  

### Test Summary
| Tool | Status | Time | Notes |
|------|--------|------|-------|
| Image Analysis | ✅/❌ | 25s | |
| Text Analysis | ✅/❌ | 12s | |
| Similar Cases | ✅/❌ | 3s | |
| Report Generation | ✅/❌ | 35s | |
| Timeline Extraction | ✅/❌ | 18s | |
| Authenticity Verification | ✅/❌ | 28s | |

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommendations
- [Recommendation]
```

---

## 🔧 Troubleshooting

### Common Issues:

#### "Gemini API key not configured"
**Solution:** Add `VITE_GEMINI_API_KEY` to `.env` file

#### "Failed to generate image"
**Solution:** Check API quota, verify image URL is accessible

#### "Network request failed"
**Solution:** Check CORS settings, verify API endpoint

#### Slow response times (>60s)
**Solution:** 
- Check network speed
- Verify Gemini API quota not exceeded
- Consider caching results

#### "Cannot find module" errors
**Solution:** Run `npm install` to ensure all dependencies installed

---

## 📞 Support

### For Issues:
1. Check browser console for errors
2. Verify API keys in `.env`
3. Review network tab for failed requests
4. Check Supabase logs for database errors
5. Test with simple case first

### Debug Mode:
```javascript
// Enable debug logging
localStorage.setItem('DEBUG_AI_TOOLS', 'true');

// Run tests with verbose output
await aiTests.runAll();
```

---

## ✅ Acceptance Criteria

**Tools are considered production-ready when:**
- [ ] All 6 tools complete successfully >95% of the time
- [ ] Average response time <30 seconds
- [ ] Error handling provides clear user feedback
- [ ] Results are accurate and useful
- [ ] UI remains responsive during processing
- [ ] No memory leaks after 20+ operations
- [ ] Works across browsers (Chrome, Firefox, Safari)
- [ ] Mobile responsive (tools accessible on tablet/phone)

---

**Last Updated:** December 4, 2025  
**Version:** 1.0  
**Status:** Ready for Testing
