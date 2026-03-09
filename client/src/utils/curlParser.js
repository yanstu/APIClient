// src/utils/curlParser.js

function parseFetch(input, result) {
  // Regex to extract URL and the options object string
  let urlMatch = input.match(/fetch\s*\(\s*(['"])(.*?)\1\s*(?:,\s*(\{[\s\S]*\}))?\s*\)/);
  if (!urlMatch) return null;

  result.url = urlMatch[2];

  if (urlMatch[3]) {
    try {
      // Safe parsing of common fetch option properties
      const optsStr = urlMatch[3]
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // ensure keys are quoted
        .replace(/'/g, '"'); // replace single quotes with double quotes for JSON.parse attempt

      // Use eval as safe as we can within a limited function scope (this handles some unquoted keys)
      const opts = (new Function(`return ${urlMatch[3]}`))();

      if (opts.method) {
        result.method = opts.method.toUpperCase();
      } else {
        result.method = 'GET';
      }

      if (opts.headers) {
        Object.entries(opts.headers).forEach(([key, value]) => {
          result.headers.push({ key, value });
        });
      }

      if (opts.body) {
        result.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
        result.bodyType = 'text';
      }
    } catch (e) {
      console.warn("Failed to parse fetch options", e);
    }
  }
}

function parseCurlCmd(input, result) {
  // 1. Remove line continuations (cmd: ^\n or bash: \\n)
  let cleanStr = input.replace(/(\^|\\)\s*\r?\n/g, ' ');

  // 2. Remove cmd escaping carets (e.g. ^", ^{, ^\, etc.)
  // We only do this if it looks like a cmd curl (contains ^)
  if (cleanStr.includes('^')) {
    cleanStr = cleanStr.replace(/\^([^\r\n]|$)/g, '$1');
  }

  // Tokenize considering single and double quotes
  // We need a loop based regex to safely grab tokens
  const tokens = [];
  let currentToken = '';
  let inQuote = null;

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];

    if (inQuote) {
      if (char === '\\' && i + 1 < cleanStr.length) {
        currentToken += cleanStr[i + 1];
        i++;
      } else if (char === inQuote) {
        inQuote = null; // matching quote closed
      } else {
        currentToken += char;
      }
    } else {
      if (char === '"' || char === "'") {
        inQuote = char;
      } else if (/\s/.test(char)) {
        if (currentToken.length > 0) {
          tokens.push(currentToken);
          currentToken = '';
        }
      } else {
        currentToken += char;
      }
    }
  }
  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  if (tokens[0] !== 'curl') return;

  let i = 1;
  let hasMethodSet = false;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      result.method = (tokens[i + 1] || '').toUpperCase();
      hasMethodSet = true;
      i += 2;
    } else if (token === '-H' || token === '--header') {
      const headerStr = tokens[i + 1] || '';
      const splitIdx = headerStr.indexOf(':');
      if (splitIdx > 0) {
        const key = headerStr.slice(0, splitIdx).trim();
        const value = headerStr.slice(splitIdx + 1).trim();
        if (key.toLowerCase() === 'authorization') {
          if (value.toLowerCase().startsWith('bearer ')) {
            result.auth.type = 'bearer';
            result.auth.token = value.slice(7).trim();
          } else if (value.toLowerCase().startsWith('basic ')) {
            result.headers.push({ key, value });
          } else {
            result.headers.push({ key, value });
          }
        } else {
          result.headers.push({ key, value });
        }
      }
      i += 2;
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      result.body = tokens[i + 1] || '';
      if (!hasMethodSet) result.method = 'POST';
      i += 2;
    } else if (token === '-u' || token === '--user') {
      const userStr = tokens[i + 1] || '';
      const parts = userStr.split(':');
      result.auth.type = 'basic';
      result.auth.username = parts[0] || '';
      result.auth.password = parts.slice(1).join(':') || '';
      i += 2;
    } else if (token === '-I' || token === '--head') {
      result.method = 'HEAD';
      hasMethodSet = true;
      i += 1;
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      result.url = token;
      i += 1;
    } else if (token.startsWith('-')) {
      i += (tokens[i + 1] && !tokens[i + 1].startsWith('-')) ? 2 : 1;
    } else {
      if (!result.url) {
        result.url = token;
      }
      i++;
    }
  }
}

export function parseCurl(inputString) {
  if (!inputString || typeof inputString !== 'string') return null;

  const rawStr = inputString.trim();

  const result = {
    method: 'GET',
    url: '',
    headers: [],
    body: '',
    auth: { type: 'none', username: '', password: '', token: '' },
    bodyType: 'none'
  };

  if (rawStr.startsWith('fetch(')) {
    parseFetch(rawStr, result);
  } else if (rawStr.startsWith('curl')) {
    parseCurlCmd(rawStr, result);
  } else {
    // Attempt fallback to default curl tokenization
    parseCurlCmd(rawStr, result);
  }

  // Determine bodyType
  if (result.body) {
    result.bodyType = 'text';
    const ctHeader = result.headers.find(h => h.key.toLowerCase() === 'content-type');
    if (ctHeader) {
      if (ctHeader.value.includes('application/json')) result.bodyType = 'json';
      else if (ctHeader.value.includes('x-www-form-urlencoded')) result.bodyType = 'x-www-form-urlencoded';
    } else {
      try {
        JSON.parse(result.body);
        result.bodyType = 'json';
      } catch (e) { }
    }
  }

  if (!result.url) return null;

  return result;
}
