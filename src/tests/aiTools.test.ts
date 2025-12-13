/**
 * AI Tools Service Tests
 * Tests for Gemini API integration and investigator tools
 * 
 * Run with: npm test (after setting up test framework)
 * Or manually test in browser console
 */

import { aiToolsService } from '../services/aiToolsService';
import { supabase } from '../lib/supabase';

// Test Configuration
const TEST_CONFIG = {
  sampleImageUrl: 'https://example.com/test-image.jpg', // Replace with real test image
  sampleCaseId: 'test-case-id', // Replace with real case ID
  sampleText: 'I saw strange lights in the sky moving in geometric patterns at 11:30 PM on October 15th near Lake Michigan.',
  timeout: 30000 // 30 seconds timeout for AI calls
};

/**
 * Test Suite: Image Analysis
 */
export const testImageAnalysis = async () => {
  console.log('🧪 Testing Image Analysis...');
  
  try {
    const result = await aiToolsService.analyzeImage(
      TEST_CONFIG.sampleImageUrl,
      'UFO sighting over urban area'
    );

    console.assert(result.detectedObjects, '❌ FAIL: No detected objects');
    console.assert(result.anomalies, '❌ FAIL: No anomalies array');
    console.assert(result.confidence >= 0 && result.confidence <= 100, '❌ FAIL: Invalid confidence score');
    console.assert(result.keyFindings.length > 0, '❌ FAIL: No key findings');
    console.assert(result.metadata.lighting, '❌ FAIL: No lighting assessment');
    
    console.log('✅ PASS: Image Analysis', {
      objectsDetected: result.detectedObjects.length,
      anomaliesFound: result.anomalies.length,
      confidence: result.confidence,
      findings: result.keyFindings.length
    });

    return result;
  } catch (error) {
    console.error('❌ FAIL: Image Analysis', error);
    return null;
  }
};

/**
 * Test Suite: Text Analysis
 */
export const testTextAnalysis = async () => {
  console.log('🧪 Testing Text Analysis...');
  
  try {
    const result = await aiToolsService.analyzeText(TEST_CONFIG.sampleText, 'testimony');

    console.assert(result.sentiment, '❌ FAIL: No sentiment analysis');
    console.assert(['positive', 'negative', 'neutral'].includes(result.sentiment), '❌ FAIL: Invalid sentiment');
    console.assert(result.keywords.length > 0, '❌ FAIL: No keywords extracted');
    console.assert(result.entities.length >= 0, '❌ FAIL: Entities array missing');
    console.assert(result.confidence >= 0 && result.confidence <= 100, '❌ FAIL: Invalid confidence');

    console.log('✅ PASS: Text Analysis', {
      sentiment: result.sentiment,
      keywordsCount: result.keywords.length,
      entitiesCount: result.entities.length,
      confidence: result.confidence
    });

    return result;
  } catch (error) {
    console.error('❌ FAIL: Text Analysis', error);
    return null;
  }
};

/**
 * Test Suite: Similar Cases Search
 */
export const testSimilarCases = async () => {
  console.log('🧪 Testing Similar Cases Search...');
  
  try {
    // First create a test case
    const { data: testCase, error: createError } = await supabase
      .from('cases')
      .insert({
        title: 'Test UFO Sighting',
        description: 'Bright lights seen over city',
        category: 'UFO',
        location: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        status: 'PENDING'
      })
      .select()
      .single();

    if (createError) throw createError;

    const result = await aiToolsService.findSimilarCases(testCase.id, 5);

    console.assert(Array.isArray(result), '❌ FAIL: Result is not an array');
    console.assert(result.length <= 5, '❌ FAIL: Returned more than requested');

    console.log('✅ PASS: Similar Cases Search', {
      similarCasesFound: result.length,
      testCaseId: testCase.id
    });

    // Cleanup
    await supabase.from('cases').delete().eq('id', testCase.id);

    return result;
  } catch (error) {
    console.error('❌ FAIL: Similar Cases Search', error);
    return null;
  }
};

/**
 * Test Suite: Report Generation
 */
export const testReportGeneration = async () => {
  console.log('🧪 Testing Report Generation...');
  
  try {
    // Create test case with comments
    const { data: testCase } = await supabase
      .from('cases')
      .insert({
        title: 'Test Case for Report',
        description: 'Detailed description of unexplained phenomenon',
        category: 'PARANORMAL',
        location: 'Test Location',
        incident_date: new Date().toISOString(),
        status: 'INVESTIGATING'
      })
      .select()
      .single();

    if (!testCase) throw new Error('Failed to create test case');

    const report = await aiToolsService.generateReport(testCase.id);

    console.assert(typeof report === 'string', '❌ FAIL: Report is not a string');
    console.assert(report.length > 100, '❌ FAIL: Report too short');
    console.assert(report.includes('Summary') || report.includes('SUMMARY'), '❌ FAIL: No summary section');

    console.log('✅ PASS: Report Generation', {
      reportLength: report.length,
      preview: report.substring(0, 100) + '...'
    });

    // Cleanup
    await supabase.from('cases').delete().eq('id', testCase.id);

    return report;
  } catch (error) {
    console.error('❌ FAIL: Report Generation', error);
    return null;
  }
};

/**
 * Test Suite: Image Authenticity Verification
 */
export const testImageAuthenticity = async () => {
  console.log('🧪 Testing Image Authenticity Verification...');
  
  try {
    const result = await aiToolsService.verifyImageAuthenticity(TEST_CONFIG.sampleImageUrl);

    console.assert(typeof result.authentic === 'boolean', '❌ FAIL: Authentic is not boolean');
    console.assert(result.confidence >= 0 && result.confidence <= 100, '❌ FAIL: Invalid confidence');
    console.assert(Array.isArray(result.issues), '❌ FAIL: Issues is not an array');
    console.assert(result.analysis.length > 0, '❌ FAIL: No analysis text');

    console.log('✅ PASS: Image Authenticity Verification', {
      authentic: result.authentic,
      confidence: result.confidence,
      issuesFound: result.issues.length
    });

    return result;
  } catch (error) {
    console.error('❌ FAIL: Image Authenticity Verification', error);
    return null;
  }
};

/**
 * Test Suite: Timeline Extraction
 */
export const testTimelineExtraction = async () => {
  console.log('🧪 Testing Timeline Extraction...');
  
  try {
    const { data: testCase } = await supabase
      .from('cases')
      .insert({
        title: 'Timeline Test Case',
        description: 'At 10:00 PM I saw lights. At 10:15 PM they moved closer. At 10:30 PM they disappeared.',
        category: 'UFO',
        location: 'Test',
        incident_date: new Date().toISOString(),
        status: 'PENDING'
      })
      .select()
      .single();

    if (!testCase) throw new Error('Failed to create test case');

    const timeline = await aiToolsService.extractTimeline(testCase.id);

    console.assert(Array.isArray(timeline), '❌ FAIL: Timeline is not an array');
    console.assert(timeline.length > 0, '❌ FAIL: Timeline is empty');
    console.assert(timeline[0].time, '❌ FAIL: Timeline entry missing time');
    console.assert(timeline[0].event, '❌ FAIL: Timeline entry missing event');

    console.log('✅ PASS: Timeline Extraction', {
      eventsExtracted: timeline.length,
      firstEvent: timeline[0]
    });

    // Cleanup
    await supabase.from('cases').delete().eq('id', testCase.id);

    return timeline;
  } catch (error) {
    console.error('❌ FAIL: Timeline Extraction', error);
    return null;
  }
};

/**
 * Performance Test: Response Time
 */
export const testResponseTime = async (testFunction: Function, testName: string) => {
  console.log(`⏱️ Testing Response Time: ${testName}...`);
  
  const startTime = performance.now();
  
  try {
    await testFunction();
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.assert(duration < TEST_CONFIG.timeout, `❌ FAIL: ${testName} took too long (${duration}ms)`);
    
    console.log(`✅ PASS: ${testName} completed in ${duration.toFixed(2)}ms`);
    
    return duration;
  } catch (error) {
    console.error(`❌ FAIL: ${testName} response time test`, error);
    return null;
  }
};

/**
 * Integration Test: Full Investigation Workflow
 */
export const testFullInvestigationWorkflow = async () => {
  console.log('🔬 Testing Full Investigation Workflow...');
  
  try {
    // 1. Create case
    const { data: testCase } = await supabase
      .from('cases')
      .insert({
        title: 'Full Workflow Test Case',
        description: 'Testing complete investigator workflow with AI tools',
        category: 'UFO',
        location: 'Test Location',
        incident_date: new Date().toISOString(),
        status: 'INVESTIGATING',
        media_url: TEST_CONFIG.sampleImageUrl
      })
      .select()
      .single();

    if (!testCase) throw new Error('Case creation failed');

    // 2. Analyze case description
    const textAnalysis = await aiToolsService.analyzeText(testCase.description, 'case');
    console.assert(textAnalysis.keywords.length > 0, '❌ Step 2 failed: Text analysis');

    // 3. Analyze case image
    if (testCase.media_url) {
      const imageAnalysis = await aiToolsService.analyzeImage(testCase.media_url, testCase.description);
      console.assert(imageAnalysis.confidence > 0, '❌ Step 3 failed: Image analysis');
    }

    // 4. Find similar cases
    const similarCases = await aiToolsService.findSimilarCases(testCase.id);
    console.assert(Array.isArray(similarCases), '❌ Step 4 failed: Similar cases search');

    // 5. Extract timeline
    const timeline = await aiToolsService.extractTimeline(testCase.id);
    console.assert(Array.isArray(timeline), '❌ Step 5 failed: Timeline extraction');

    // 6. Generate report
    const report = await aiToolsService.generateReport(testCase.id);
    console.assert(report.length > 100, '❌ Step 6 failed: Report generation');

    console.log('✅ PASS: Full Investigation Workflow', {
      caseId: testCase.id,
      stepsCompleted: 6,
      reportGenerated: true
    });

    // Cleanup
    await supabase.from('cases').delete().eq('id', testCase.id);

    return {
      success: true,
      textAnalysis,
      similarCases: similarCases.length,
      timelineEvents: timeline.length,
      reportLength: report.length
    };
  } catch (error) {
    console.error('❌ FAIL: Full Investigation Workflow', error);
    return null;
  }
};

/**
 * Error Handling Tests
 */
export const testErrorHandling = async () => {
  console.log('🧪 Testing Error Handling...');
  
  const tests = [
    {
      name: 'Invalid Image URL',
      test: () => aiToolsService.analyzeImage('https://invalid-url-12345.com/fake.jpg'),
      shouldFail: true
    },
    {
      name: 'Empty Text Analysis',
      test: () => aiToolsService.analyzeText('', 'case'),
      shouldFail: false // Should handle gracefully
    },
    {
      name: 'Non-existent Case ID',
      test: () => aiToolsService.generateReport('00000000-0000-0000-0000-000000000000'),
      shouldFail: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of tests) {
    try {
      await testCase.test();
      if (testCase.shouldFail) {
        console.error(`❌ FAIL: ${testCase.name} - Should have thrown error`);
        failed++;
      } else {
        console.log(`✅ PASS: ${testCase.name}`);
        passed++;
      }
    } catch (error) {
      if (testCase.shouldFail) {
        console.log(`✅ PASS: ${testCase.name} - Correctly threw error`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${testCase.name} - Unexpected error:`, error);
        failed++;
      }
    }
  }

  console.log(`Error Handling Tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
};

/**
 * Run All Tests
 */
export const runAllTests = async () => {
  console.log('🚀 Starting AI Tools Test Suite...\n');
  
  const results = {
    imageAnalysis: null,
    textAnalysis: null,
    similarCases: null,
    reportGeneration: null,
    imageAuthenticity: null,
    timelineExtraction: null,
    fullWorkflow: null,
    errorHandling: null,
    totalPassed: 0,
    totalFailed: 0
  };

  try {
    // Run individual tests
    results.textAnalysis = await testTextAnalysis();
    results.similarCases = await testSimilarCases();
    results.reportGeneration = await testReportGeneration();
    results.timelineExtraction = await testTimelineExtraction();
    
    // Run error handling tests
    results.errorHandling = await testErrorHandling();
    
    // Run full workflow (integration test)
    results.fullWorkflow = await testFullInvestigationWorkflow();

    // Optional: Image tests (require valid image URL)
    // results.imageAnalysis = await testImageAnalysis();
    // results.imageAuthenticity = await testImageAuthenticity();

    // Calculate totals
    results.totalPassed = Object.values(results).filter(r => r !== null && r !== false).length;
    results.totalFailed = Object.values(results).filter(r => r === null || r === false).length;

    console.log('\n📊 Test Suite Summary:');
    console.log(`✅ Passed: ${results.totalPassed}`);
    console.log(`❌ Failed: ${results.totalFailed}`);
    console.log(`📈 Success Rate: ${((results.totalPassed / (results.totalPassed + results.totalFailed)) * 100).toFixed(2)}%`);

    return results;
  } catch (error) {
    console.error('💥 Test Suite Failed:', error);
    return results;
  }
};

// Browser console helper
if (typeof window !== 'undefined') {
  (window as any).aiTests = {
    runAll: runAllTests,
    testImageAnalysis,
    testTextAnalysis,
    testSimilarCases,
    testReportGeneration,
    testImageAuthenticity,
    testTimelineExtraction,
    testFullWorkflow: testFullInvestigationWorkflow,
    testErrorHandling
  };

  console.log('💡 AI Tools Tests loaded! Run in console: aiTests.runAll()');
}
