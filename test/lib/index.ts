#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
// tslint:disable:max-line-length
// tslint:disable:object-literal-key-quotes
import { test } from 'tap';
import fun from '../../lib';

test('Is everything ready for the development?', async (t) => {
  t.true(fun(), 'Yes');
});
