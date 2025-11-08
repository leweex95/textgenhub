#!/usr/bin/env node
'use strict';

const GrokProvider = require('./grok');
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
    .option('output-format', { type: 'string', choices: ['json', 'html'], default: 'json' })
    .argv;

  // Always enable debug mode for investigation
  const provider = new GrokProvider({
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
            let artifactPath = null;
            if (typeof provider.saveHtmlArtifact === 'function') {
              artifactPath = await provider.saveHtmlArtifact('continuous-error');
            }
            // Always print JSON to stdout
            console.log(JSON.stringify({ error: err.message, prompt, artifactPath }));
          }
        }
      });
      rl.on('close', async () => {
        await provider.cleanup();
        process.exit(0);
      });
    } else {
      // Single prompt mode
      let response = null;
      let artifactPath = null;
      let errorObj = null;
      try {
        response = await provider.generateContent(argv.prompt);
        // Validate response if expected is provided
        if (argv.expected && response.trim() !== argv.expected.trim()) {
          if (typeof provider.saveHtmlArtifact === 'function') {
            artifactPath = await provider.saveHtmlArtifact('wrong-answer');
          }
          throw new Error(`Grok regression test failed: expected "${argv.expected}", got "${response}"`);
        }
        // Success: print response based on format
        if (argv['output-format'] === 'html') {
          // For HTML output, try to get HTML content if available
          const html = provider.getLastHtml ? await provider.getLastHtml() : '';
          console.log(html || response);
        } else {
          // JSON output with metadata
          const html = provider.getLastHtml ? await provider.getLastHtml() : '';
          console.log(JSON.stringify({
            response,
            html
          }, null, 2));
        }
      } catch (err) {
        if (!artifactPath && typeof provider.saveHtmlArtifact === 'function') {
          artifactPath = await provider.saveHtmlArtifact('error');
        }
        errorObj = { error: err.message, artifactPath };
        // Always print JSON to stdout
        console.log(JSON.stringify(errorObj));
        // Exit with error code
        process.exit(1);
      }
      await provider.cleanup();
    }
  } catch (err) {
    // Print full error context for debugging
    console.error('[Grok CLI ERROR]', {
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
