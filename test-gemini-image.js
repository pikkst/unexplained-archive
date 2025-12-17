// Test script for Gemini Image Generation API
// Run with: GEMINI_API_KEY=your_key_here node test-gemini-image.js

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY environment variable not set');
  console.error('Usage: GEMINI_API_KEY=your_key_here node test-gemini-image.js');
  process.exit(1);
}

async function testImageGeneration() {
  console.log('🧪 Testing Gemini Image Generation API...\n');
  
  const prompt = 'A bright mysterious light hovering over a dark forest at night, photorealistic style';
  
  // Test the correct model names from documentation
  const models = [
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
  ];
  
  for (const model of models) {
    console.log(`\n📍 Testing model: ${model}`);
    console.log('─'.repeat(50));
    
    try {
      let response;
      let body;
      
      if (model.startsWith('imagen')) {
        // Imagen API has different structure
        body = {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
          }
        };
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }
        );
      } else {
        // Gemini multimodal API
        body = {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ['Text', 'Image'],
          }
        };
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }
        );
      }
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`❌ Error: ${data.error.message}`);
        console.log(`   Code: ${data.error.code}`);
        if (data.error.details) {
          console.log(`   Details:`, JSON.stringify(data.error.details, null, 2));
        }
      } else if (data.candidates) {
        // Check for image in response
        let foundImage = false;
        for (const candidate of data.candidates) {
          for (const part of candidate.content?.parts || []) {
            if (part.inline_data?.data || part.inlineData?.data) {
              foundImage = true;
              const imageData = part.inline_data?.data || part.inlineData?.data;
              console.log(`✅ SUCCESS! Image generated (${Math.round(imageData.length / 1024)} KB base64)`);
              
              // Save image to file
              const fs = require('fs');
              const buffer = Buffer.from(imageData, 'base64');
              const filename = `test-image-${model.replace(/[^a-z0-9]/gi, '-')}.png`;
              fs.writeFileSync(filename, buffer);
              console.log(`   💾 Saved to: ${filename}`);
            }
            if (part.text) {
              console.log(`   📝 Text response: ${part.text.substring(0, 100)}...`);
            }
          }
        }
        if (!foundImage) {
          console.log('⚠️  Response received but no image found');
          console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 500));
        }
      } else if (data.predictions) {
        // Imagen response
        console.log(`✅ SUCCESS! Imagen generated ${data.predictions.length} image(s)`);
        const fs = require('fs');
        data.predictions.forEach((pred, i) => {
          if (pred.bytesBase64Encoded) {
            const buffer = Buffer.from(pred.bytesBase64Encoded, 'base64');
            const filename = `test-imagen-${i}.png`;
            fs.writeFileSync(filename, buffer);
            console.log(`   💾 Saved to: ${filename}`);
          }
        });
      } else {
        console.log('⚠️  Unexpected response structure:');
        console.log(JSON.stringify(data, null, 2).substring(0, 800));
      }
      
    } catch (err) {
      console.log(`❌ Fetch error: ${err.message}`);
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('🏁 Test complete!\n');
}

testImageGeneration();
