import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixTemplateLogo() {
  console.log('Loading original template...');
  const templatePath = path.join(__dirname, 'template__Comp.pptx');
  const templateBuffer = await fs.promises.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  console.log('Loading new logo...');
  const logoPath = path.join(__dirname, '..', 'public', 'healthrise-logo.png');
  const logoBuffer = await fs.promises.readFile(logoPath);

  console.log('Replacing logo in template...');
  // Replace the corrupted logo (image2.jpg) with the correct one
  zip.file('ppt/media/image2.jpg', logoBuffer);

  console.log('Generating fixed template...');
  const fixedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  console.log('Saving fixed template...');
  const outputPath = path.join(__dirname, 'template__Comp.pptx');
  await fs.promises.writeFile(outputPath, fixedBuffer);

  console.log('✅ Template logo fixed successfully!');
  console.log(`Fixed template saved to: ${outputPath}`);
}

fixTemplateLogo().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
