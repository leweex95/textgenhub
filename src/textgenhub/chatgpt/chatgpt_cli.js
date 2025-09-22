#!/usr/bin/env node
'use strict';

const ChatGPTProvider = require('./chatgpt');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

(async () => {
  const argv = yargs(hideBin(process.argv))
    .option('prompt', { type: 'string', demandOption: true })
    .option('headless', { type: 'boolean', default: true })
    .option('remove-cache', { type: 'boolean', default: true })
    .argv;

  const provider = new ChatGPTProvider({ headless: argv.headless, removeCache: argv['remove-cache'] });

  try {
    await provider.initialize();
    const response = await provider.generateContent(argv.prompt);
    console.log(JSON.stringify({ response }));
    await provider.cleanup();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
