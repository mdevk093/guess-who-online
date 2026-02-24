const { execSync } = require('child_process');
const path = require('path');

const src = '/Users/manishdevkota/.gemini/antigravity/brain/08155e1f-dfa5-47e9-9560-180365d99c2a/media__1771712256612.png';
const dstDir = '/Users/manishdevkota/.gemini/antigravity/scratch/guess-who-online/server/public/classic';

const characters = [
    'Basil', 'Melvin', 'Hannah', 'Simone', 'Ian', 'Isla', 'Rupert', 'Maggie',
    'Susan', 'Natalie', 'Kim', 'Stephen', 'Joshua', 'Xiao Mei', 'Jennifer', 'Brian',
    'Gary', 'Martine', 'Bill', 'Roy', 'Edna', 'Mo', 'Kelly', 'Pete'
];

const imgW = 1024;
const imgH = 575;
const centerW = imgW / 2;
const centerH = imgH / 2;

const cardW = 124; // Slightly narrower than total col to avoid borders
const cardH = 158;

// Y centers estimated from image
const yCenters = [85, 245, 405];

for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
        const charIndex = row * 8 + col;
        const name = characters[charIndex].toLowerCase().replace(/\s+/g, '_');
        const xCenter = col * 128 + 64;
        const yCenter = yCenters[row];

        const offsetW = xCenter - centerW;
        const offsetH = yCenter - centerH;

        const outPath = path.join(dstDir, `${name}.png`);

        // sips --cropToHeightWidth 150 128 --cropOffset OFFSET_H OFFSET_W src --out dst
        const cmd = `sips --cropToHeightWidth ${cardH} ${cardW} --cropOffset ${offsetH} ${offsetW} "${src}" --out "${outPath}"`;

        console.log(`Processing ${characters[charIndex]}...`);
        try {
            execSync(cmd);
        } catch (err) {
            console.error(`Failed to crop ${characters[charIndex]}:`, err.message);
        }
    }
}
