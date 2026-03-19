import { readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = './dist/cjs';

for (const file of readdirSync(dir, { recursive: true })) {
    if (file.endsWith('.js')) {
        const from = join(dir, file);
        const to = join(dir, file.replace(/\.js$/, '.cjs'));
        renameSync(from, to);
    }
}

writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2));