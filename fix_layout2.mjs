import { globSync } from 'glob';
import { readFileSync, writeFileSync } from 'fs';

const files = globSync(['src/app/**/*.tsx', 'src/components/**/*.tsx']);
for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let newContent = content
    .replace(/max-w-7xl/g, 'w-full')
    .replace(/max-w-6xl/g, 'w-full');
  
  if (content !== newContent) {
    writeFileSync(file, newContent, 'utf-8');
    console.log('Updated ' + file);
  }
}
