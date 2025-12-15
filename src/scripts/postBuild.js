const fs = require('fs');
const path = require('path');

// Path relative to the project root where the compiled script lives
const SCRIPT_PATH = path.join(__dirname, 'dist', 'scripts', 'generateModels.js');
const SHEBANG = '#!/usr/bin/env node\n';

try {
    let content = fs.readFileSync(SCRIPT_PATH, 'utf8');

    // Check if the Shebang is already there (to prevent duplicates)
    if (!content.startsWith(SHEBANG)) {
        content = SHEBANG + content;
        fs.writeFileSync(SCRIPT_PATH, content, 'utf8');
        console.log(`✅ Shebang added to ${path.basename(SCRIPT_PATH)}.`);
    } else {
        console.log(`ℹ️ Shebang already present in ${path.basename(SCRIPT_PATH)}.`);
    }

} catch (error) {
    console.error(`❌ Error processing script ${SCRIPT_PATH}:`, error.message);
    process.exit(1);
}