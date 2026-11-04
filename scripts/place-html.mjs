import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const directoryPages = ['2', '3', '4', '5', 'about'];

for (const name of directoryPages) {
  const from = path.join(dist, `${name}.html`);
  const to = path.join(dist, name, 'index.html');
  if (!fs.existsSync(from)) {
    if (!fs.existsSync(to)) {
      throw new Error(`Expected ${from} so /${name}/ can keep its trailing slash`);
    }
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}
