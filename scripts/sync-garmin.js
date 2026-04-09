#!/usr/bin/env node
/**
 * Sync Garmin activities - Compatible entry point
 * Redirects to scripts/garmin/sync.js
 */

console.log('Redirecting to scripts/garmin/sync.js...');

// Forward all arguments
const args = process.argv.slice(2);
process.argv = [process.argv[0], 'scripts/garmin/sync.js', ...args];

require('./garmin/sync.js');
