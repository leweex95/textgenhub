const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

describe('ChatGPT response scraping', function () {
  this.timeout(30000);

  let browser;
  let page;
  let scrapeResponse;

  before(async function () {
    ({ scrapeResponse } = await import('../src/textgenhub/webui/chatgpt/lib/index.js'));
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  });

  after(async function () {
    if (browser) await browser.close();
  });

  it('scrapes only the new assistant turn from ChatGPT accessible headings', async function () {
    await page.setContent(`
      <main>
        <div><h4>You said:</h4><div>Earlier question</div></div>
        <div><h4>ChatGPT said:</h4><div>Earlier answer</div></div>
        <div><h4>You said:</h4><div>New question</div></div>
        <div><h4>ChatGPT said:</h4><div>New answer</div></div>
      </main>
    `);

    assert.equal(await scrapeResponse(page, 1), 'New answer');
  });

  it('does not return an earlier assistant turn when no new response exists', async function () {
    await page.setContent(`
      <main><div><h4>ChatGPT said:</h4><div>Earlier answer</div></div></main>
    `);

    await assert.rejects(
      scrapeResponse(page, 1),
      /No new assistant responses found/
    );
  });
});
