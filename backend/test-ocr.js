const ocrService = require('./services/ocr');
const logger = require('./utils/logger');

async function testOCR() {
    console.log('\n=== Testing OCR Service ===\n');
    
    const testFile = process.argv[2];
    
    if (!testFile) {
        console.log('Usage: node test-ocr.js <image-file-path>');
        process.exit(1);
    }
    
    try {
        console.log(`Testing file: ${testFile}\n`);
        
        // Detect MIME type based on extension
        let mimeType = 'image/png';
        if (testFile.endsWith('.jpg') || testFile.endsWith('.jpeg')) {
            mimeType = 'image/jpeg';
        }
        
        const result = await ocrService.extractText(testFile, mimeType);
        
        console.log('\n=== OCR Result ===');
        console.log(`Method: ${result.method}`);
        console.log(`Confidence: ${result.confidence}%`);
        console.log(`Text Length: ${result.text.length} characters`);
        console.log('\n=== Extracted Text ===');
        console.log(result.text);
        console.log('\n=== Test Complete ===\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ OCR Test Failed:', error.message);
        process.exit(1);
    }
}

testOCR();
