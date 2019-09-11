const { promisify } = require('util');
const fs = require('fs');

const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);

(async () => {
    try {
        await main();
    } catch (err) {
        console.error(err);
    }
})();

async function main() {
    if (!fs.existsSync('dist')) {
        await mkdir('dist');
    }

    await copyFile('package.json', 'dist/package.json');
}
