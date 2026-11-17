export class NoPageError extends Error {
  constructor(message = 'ChatGPT page not found') {
    super(message);
    this.name = 'NoPageError';
  }
}

export class ScrapeError extends Error {
  constructor(message = 'Failed to scrape response') {
    super(message);
    this.name = 'ScrapeError';
  }
}

export class LoginRequiredError extends Error {
  constructor(message = 'User not logged in') {
    super(message);
    this.name = 'LoginRequiredError';
  }
}

export class SessionInvalidError extends Error {
  constructor(message = 'Session is invalid or expired') {
    super(message);
    this.name = 'SessionInvalidError';
  }
}
