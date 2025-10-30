#!/usr/bin/env node
'use strict';

const ChatGPTProvider = require('./chatgpt');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

(async () => {
  const argv = yargs(hideBin(process.argv))
    .option('prompt', { type: 'string', demandOption: false })
    .option('expected', { type: 'string', demandOption: false })
    .option('headless', { type: 'boolean', default: true })
    .option('remove-cache', { type: 'boolean', default: false })
    .option('continuous', { type: 'boolean', default: false })
    .option('debug', { type: 'boolean', default: true }) // Force debug true
    .argv;

  // Always enable debug mode for investigation
  const provider = new ChatGPTProvider({
    headless: argv.headless,
    removeCache: argv['remove-cache'],
    continuous: argv.continuous,
    debug: true
  });

  try {
    await provider.initialize();
    
    if (argv.continuous) {
      // Continuous mode: read prompts from stdin
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });
      
      rl.on('line', async (line) => {
        const prompt = line.trim();
        if (prompt) {
          try {
            const response = await provider.generateContent(prompt);
            console.log(JSON.stringify({ response, prompt }));
          } catch (err) {
            console.error(JSON.stringify({ error: err.message, prompt }));
          }
        }
      });
      
      rl.on('close', async () => {
        await provider.cleanup();
        process.exit(0);
      });
    } else {
      // Single prompt mode
      const response = await provider.generateContent(argv.prompt);

      // Validate response if expected is provided
      if (argv.expected && response.trim() !== argv.expected.trim()) {
        // Save HTML artifact before cleanup
        if (typeof provider.saveHtmlArtifact === 'function') {
          await provider.saveHtmlArtifact('wrong-answer');
        }
        throw new Error(`ChatGPT regression test failed: expected "${argv.expected}", got "${response}"`);
      }

      console.log(JSON.stringify({ response }));
      await provider.cleanup();
    }
  } catch (err) {
    // Print full error context for debugging
    console.error('[ChatGPT CLI ERROR]', {
      message: err.message,
      stack: err.stack,
      originalError: err.originalError ? {
        message: err.originalError.message,
        stack: err.originalError.stack
      } : undefined
    });
    process.exit(1);
  }
})();
