# Node.js Usage

## Quick Start

```javascript
const { ChatGPT, DeepSeek, Perplexity, Grok } = require('textgenhub');
```

## ChatGPT

```javascript
const { ChatGPT } = require('textgenhub');

const chatgpt = new ChatGPT();
chatgpt.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

## DeepSeek

```javascript
const { DeepSeek } = require('textgenhub');

const deepseek = new DeepSeek();
deepseek.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

## Perplexity

```javascript
const { Perplexity } = require('textgenhub');

const perplexity = new Perplexity();
perplexity.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

## Grok

```javascript
const { Grok } = require('textgenhub');

const grok = new Grok();
grok.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```
