// Test Edge Function directly
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseXlqdmJlbWRzdWJtbnZ1ZHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MDQwMjcsImV4cCI6MjA4MDk4MDAyN30.cMM9sMWjisULhmzCEej5RnhI7Q69szJX7GCR4q0Yst4';

async function testEdgeFunction() {
  console.log('Testing Edge Function...\n');
  
  const response = await fetch('https://plyyjvbemdsubmnvudvr.supabase.co/functions/v1/ai-analysis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      action: 'generate-image',
      userId: 'test123',
      caseId: null,
      description: 'A bright light in the sky over a forest',
      category: 'UFO',
      location: 'Estonia'
    })
  });
  
  console.log('Status:', response.status, response.statusText);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  
  const text = await response.text();
  console.log('\nResponse body:');
  console.log(text);
  
  try {
    const json = JSON.parse(text);
    console.log('\nParsed JSON:');
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('Not JSON');
  }
}

testEdgeFunction();
