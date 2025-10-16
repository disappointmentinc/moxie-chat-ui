import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixTemplateLogo() {
  console.log('Loading original template...');
  const templatePath = path.join(__dirname, 'template__Comp.pptx');
  const templateBuffer = await fs.promises.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  console.log('Loading and converting logo to JPEG...');
  const logoPath = path.join(__dirname, '..', 'public', 'Healthrise logo WHITE.webp');
  const logoBuffer = await fs.promises.readFile(logoPath);

  // Convert WebP to JPEG with dark background (logo has white text for dark backgrounds)
  const jpegLogoBuffer = await sharp(logoBuffer)
    .flatten({ background: '#0f1d42' })
    .jpeg({ quality: 95, progressive: true, force: true })
    .toBuffer();

  console.log('Replacing logo in template...');
  // Replace the corrupted logo (image2.jpg) with the correct JPEG
  zip.file('ppt/media/image2.jpg', jpegLogoBuffer);

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
