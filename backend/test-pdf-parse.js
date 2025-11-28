const pdfParse = require('pdf-parse');
const fs = require('fs');

console.log('pdf-parse type:', typeof pdfParse);
console.log('pdf-parse:', pdfParse);

async function test() {
  try {
    const buffer = fs.readFileSync('uploads/document-1764363783810-150598393.pdf');
    console.log('Buffer length:', buffer.length);
    
    const data = await pdfParse(buffer);
    console.log('Success!');
    console.log('Pages:', data.numpages);
    console.log('Text length:', data.text.length);
    console.log('First 100 chars:', data.text.substring(0, 100));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
