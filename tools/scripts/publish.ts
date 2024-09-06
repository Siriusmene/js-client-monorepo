import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const [, , packageName] = process.argv;

if (typeof packageName !== 'string') {
  throw new Error(`Invalid package name: ${packageName}`);
}

const root = path.resolve(__dirname, '../../');
const dir = `${root}/dist/packages/${packageName}`;
const configPath = `${dir}/package.json`;

if (!existsSync(`${root}/.npmrc`)) {
  // put a .npmrc file in the root sdk directory
  // should look like: //registry.npmjs.org/:_authToken=npm_YOUR_TOKEN_TO_PUBLISH
  throw new Error(`.npmrc file not found it root directory`);
}

if (!existsSync(configPath)) {
  throw new Error(`Failed to find package.json at ${configPath}`);
}

try {
  execSync(
    `npm publish --registry=https://registry.npmjs.org/ --userconfig=${root}/.npmrc --access public`,
    { cwd: dir },
  );
} catch {
  throw new Error(`Failed to publish ${packageName}`);
}
