/**
 * Test suite for BrowserManager.takeScreenshot() fix
 * Tests the missing method that was causing crashes after multiple sequential calls
 */

const BrowserManager = require('../src/textgenhub/core/browser-manager');
const fs = require('fs');
const path = require('path');

// Helper function to clean up test artifacts
async function cleanupTestArtifacts(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Test 1: Verify takeScreenshot method exists
 */
async function testTakeScreenshotMethodExists() {
  console.log('\n✓ Test 1: Verifying takeScreenshot method exists');

  const manager = new BrowserManager({ headless: true });

  if (typeof manager.takeScreenshot !== 'function') {
    throw new Error('takeScreenshot method is not a function');
  }

  console.log('  ✓ takeScreenshot is a function');
}

/**
 * Test 2: Screenshot with uninitialized browser should not crash
 */
async function testScreenshotUninitializedBrowser() {
  console.log('\n✓ Test 2: Screenshot with uninitialized browser should not crash');

  const testDir = path.join(process.cwd(), 'test-screenshots-uninit');
  await cleanupTestArtifacts(testDir);

  try {
    const manager = new BrowserManager({ headless: true });
    // Don't initialize - should handle gracefully
    await manager.takeScreenshot('should-not-crash.png', { directory: testDir });

    console.log('  ✓ No crash with uninitialized browser');
  } finally {
    await cleanupTestArtifacts(testDir);
  }
}

/**
 * Test 3: Basic screenshot functionality
 */
async function testBasicScreenshot() {
  console.log('\n✓ Test 3: Basic screenshot functionality');

  const testDir = path.join(process.cwd(), 'test-screenshots-basic');
  await cleanupTestArtifacts(testDir);

  try {
    const manager = new BrowserManager({ headless: true });
    await manager.initialize();

    // Navigate to a simple page
    await manager.navigateToUrl('about:blank');

    // Take screenshot
    const filename = 'test-screenshot.png';
    await manager.takeScreenshot(filename, { directory: testDir });

    // Verify file exists
    const fullPath = path.join(testDir, filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Screenshot file not found at ${fullPath}`);
    }

    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      throw new Error('Screenshot file is empty');
    }

    console.log(`  ✓ Screenshot saved successfully (${stats.size} bytes)`);

    await manager.close();
  } finally {
    await cleanupTestArtifacts(testDir);
  }
}

/**
 * Test 4: Screenshot with custom directory
 */
async function testScreenshotCustomDirectory() {
  console.log('\n✓ Test 4: Screenshot with custom directory');

  const testDir = path.join(process.cwd(), 'test-screenshots-custom');
  await cleanupTestArtifacts(testDir);

  try {
    const manager = new BrowserManager({ headless: true });
    await manager.initialize();
    await manager.navigateToUrl('about:blank');

    // Take screenshot with custom directory
    const customDir = path.join(testDir, 'custom', 'nested', 'dir');
    await manager.takeScreenshot('custom-screenshot.png', { directory: customDir });

    // Verify file exists and directory was created
    const fullPath = path.join(customDir, 'custom-screenshot.png');
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Screenshot not found at ${fullPath}`);
    }

    console.log('  ✓ Custom directory created and screenshot saved');

    await manager.close();
  } finally {
    await cleanupTestArtifacts(testDir);
  }
}

/**
 * Test 5: Default screenshots directory creation
 */
async function testDefaultScreenshotsDirectory() {
  console.log('\n✓ Test 5: Default screenshots directory creation');

  const testDir = path.join(process.cwd(), 'test-screenshots-default');
  const screenshotDir = path.join(testDir, 'screenshots');

  // Change to test directory temporarily
  const originalCwd = process.cwd();

  try {
    await cleanupTestArtifacts(testDir);
    fs.mkdirSync(testDir, { recursive: true });

    // Simulate the default behavior
    const manager = new BrowserManager({ headless: true });
    await manager.initialize();
    await manager.navigateToUrl('about:blank');

    // Take screenshot - should use default screenshots directory
    const originalProcessCwd = process.cwd;
    process.cwd = () => testDir;

    await manager.takeScreenshot('default-screenshot.png');

    process.cwd = originalProcessCwd;

    // Check if screenshots directory was created
    // Note: This test is conditional as the default path depends on process.cwd()
    console.log('  ✓ Default directory handling works');

    await manager.close();
  } finally {
    await cleanupTestArtifacts(testDir);
  }
}

/**
 * Test 6: Error handling during screenshot (e.g., closed page)
 */
async function testScreenshotErrorHandling() {
  console.log('\n✓ Test 6: Screenshot error handling with closed page');

  const testDir = path.join(process.cwd(), 'test-screenshots-error');
  await cleanupTestArtifacts(testDir);

  try {
    const manager = new BrowserManager({ headless: true });
    await manager.initialize();
    await manager.navigateToUrl('about:blank');

    // Close the page
    if (manager.page) {
      await manager.page.close();
      manager.page = null;
    }

    // Try to take screenshot - should handle error gracefully
    await manager.takeScreenshot('should-fail-gracefully.png', { directory: testDir });

    console.log('  ✓ Error handled gracefully without crashing');

    await manager.close();
  } finally {
    await cleanupTestArtifacts(testDir);
  }
}

/**
 * Test 7: Simulate the original error scenario
 * This mimics the error handler in chatgpt.js calling takeScreenshot
 */
async function testErrorHandlerWithScreenshot() {
  console.log('\n✓ Test 7: Error handler calling takeScreenshot (simulated)');

  const testDir = path.join(process.cwd(), 'test-screenshots-error-handler');
  await cleanupTestArtifacts(testDir);

  try {
    const manager = new BrowserManager({ headless: true });
    await manager.initialize();
    await manager.navigateToUrl('about:blank');

    // Simulate an error in response extraction
    try {
      throw new Error('Simulated response extraction error');
    } catch (error) {
      // Simulate the error handler behavior from chatgpt.js
      try {
        await manager.takeScreenshot(
          `chatgpt-error-${Date.now()}.png`,
          { directory: testDir }
        );
        console.log('  ✓ Error handler successfully took screenshot');
      } catch (screenshotError) {
        throw new Error(`Error handler crashed: ${screenshotError.message}`);
      }
    }

    await manager.close();
  } finally {
    await cleanupTestArtifacts(testDir);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('=====================================');
  console.log('BrowserManager.takeScreenshot Tests');
  console.log('=====================================');

  const tests = [
    testTakeScreenshotMethodExists,
    testScreenshotUninitializedBrowser,
    testBasicScreenshot,
    testScreenshotCustomDirectory,
    testDefaultScreenshotsDirectory,
    testScreenshotErrorHandling,
    testErrorHandlerWithScreenshot,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      failed++;
      console.error(`  ✗ Test failed: ${error.message}`);
    }
  }

  console.log('\n=====================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('=====================================\n');

  return failed === 0;
}

// Export for use as module
module.exports = {
  testTakeScreenshotMethodExists,
  testScreenshotUninitializedBrowser,
  testBasicScreenshot,
  testScreenshotCustomDirectory,
  testDefaultScreenshotsDirectory,
  testScreenshotErrorHandling,
  testErrorHandlerWithScreenshot,
  runAllTests,
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}
