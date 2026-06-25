import { EventEmitter } from 'events';

export class Logger extends EventEmitter {
  constructor(prefix = 'chatgpt-attach') {
    super();
    this.prefix = prefix;
  }

  log(event, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...data
    };
    console.log(JSON.stringify(logEntry));
    this.emit(event, data);
  }

  info(message, data = {}) {
    this.log('info', { level: 'info', message, ...data });
  }

  error(message, data = {}) {
    this.log('error', { level: 'error', message, ...data });
  }

  debug(message, data = {}) {
    this.log('debug', { level: 'debug', message, ...data });
  }

  connected(url) {
    this.log('connected', { remoteDebuggingUrl: url });
  }

  launched(browserPath) {
    this.log('launched', { browserPath });
  }

  loginRequired() {
    this.log('login_required', {});
  }

  promptSent(prompt) {
    this.log('prompt_sent', { prompt });
  }

  responseReceived(response) {
    this.log('response_received', { responseLength: response.length });
  }

  rateLimit(trial, maxTrials) {
    this.log('rate_limit', { trial, maxTrials, message: "Rate limit detected. Waiting 5 minutes before retry." });
  }

  sessionInvalid() {
    this.log('session_invalid', {});
  }
}

export const globalLogger = new Logger('chatgpt-attach');
