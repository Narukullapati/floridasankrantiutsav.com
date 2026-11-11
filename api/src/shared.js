const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

const load = (file) => JSON.parse(fs.readFileSync(path.join(config.sharedDir, file), 'utf8'));

module.exports = {
  disclaimer: load('disclaimer.json'),
  options: load('volunteer-options.json'),
};
