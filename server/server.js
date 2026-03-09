require('dotenv').config();
const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const axios = require('axios');
const FormData = require('form-data');
const swaggerJSDoc = require('swagger-jsdoc');
const { koaSwagger } = require('koa2-swagger-ui');
const multer = require('@koa/multer');
const url = require('url'); // Added for URL parsing
const mysql = require('mysql2/promise');

const upload = multer(); // for mock endpoint form-data parsing

// ==========================================
// Database Configuration
// ==========================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aliclient',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to safely stringify objects
const safeStringify = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
};

const app = new Koa();
const router = new Router();

app.use(cors());

// Global Error Handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: err.message || 'Internal Server Error'
    };
    ctx.app.emit('error', err, ctx);
  }
});

// Limit request body payload to 20MB as per user requirements
app.use(bodyParser({
  enableTypes: ['json', 'form', 'text'],
  jsonLimit: '20mb',
  formLimit: '20mb',
  textLimit: '20mb'
}));

// ==========================================
// Swagger Configuration
// ==========================================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nebula Mock API',
      version: '1.0.0',
      description: 'Mock APIs for Nebula API Client testing.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer'
        },
        basicAuth: {
          type: 'http',
          scheme: 'basic'
        }
      }
    }
  },
  apis: ['./server.js'], // Look for swagger definitions in this file
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);

router.get('/swagger.json', (ctx) => {
  ctx.body = swaggerSpec;
});

app.use(
  koaSwagger({
    routePrefix: '/docs',
    swaggerOptions: {
      url: '/swagger.json',
    },
  })
);

// ==========================================
// SSRF 防护判断 (SSRF Protection)
// ==========================================
function isInternalIp(host) {
  // 只做简单的字符串正则拦截。如果需要更严谨的防护可以走 dns.lookup
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  // 阻止访问云服务商元数据接口
  if (host === '169.254.169.254') return true;
  return false;
}

// ==========================================
// Proxy Endpoint (代理接口)
// ==========================================
router.post('/api/proxy', async (ctx) => {
  const { method, url, headers = {}, body, auth, bodyType } = ctx.request.body;

  if (!url) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'URL is required / 必须提供 URL' };
    return;
  }

  // SSRF 检查基础版
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      ctx.status = 403;
      ctx.body = { success: false, message: '协议不被允许，仅支持 http/https / Protocol not allowed' };
      return;
    }
    if (isInternalIp(parsedUrl.hostname)) {
      ctx.status = 403;
      ctx.body = { success: false, message: '禁止访问内部网络或受保护的地址 / Access to internal network is forbidden' };
      return;
    }
  } catch (err) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的 URL 地址 / Invalid URL' };
    return;
  }

  // Handle Auth (处理认证)
  const reqHeaders = { ...headers };
  if (auth) {
    if (auth.type === 'basic' && auth.username && auth.password) {
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      reqHeaders['Authorization'] = `Basic ${credentials}`;
    } else if (auth.type === 'bearer' && auth.token) {
      reqHeaders['Authorization'] = `Bearer ${auth.token}`;
    }
  }

  let finalData = body;

  // Handle specific body types
  if (bodyType === 'form-data' && Array.isArray(body)) {
    const formData = new FormData();
    body.forEach(item => {
      if (item.key) formData.append(item.key, item.value || '');
    });
    finalData = formData;
    Object.assign(reqHeaders, formData.getHeaders());
  } else if (bodyType === 'x-www-form-urlencoded' && Array.isArray(body)) {
    const params = new URLSearchParams();
    body.forEach(item => {
      if (item.key) params.append(item.key, item.value || '');
    });
    finalData = params.toString();
    reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (bodyType === 'text') {
    reqHeaders['Content-Type'] = 'text/plain';
    finalData = typeof body === 'string' ? body : String(body);
  } else if (bodyType === 'json' && body) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const startTime = Date.now();

  try {
    const response = await axios({
      method: method || 'GET',
      url,
      headers: reqHeaders,
      data: finalData,
      responseType: 'arraybuffer', // Capture as raw binary
      validateStatus: () => true
    });

    const duration = Date.now() - startTime;
    const contentType = response.headers['content-type'] || '';

    // Process response payload based on content-type
    let returnData;
    if (contentType.includes('image/') || contentType.includes('video/')) {
      // It's a media type, convert to base64 data URI format for frontend rendering
      const base64Data = Buffer.from(response.data, 'binary').toString('base64');
      returnData = `data:${contentType};base64,${base64Data}`;
    } else {
      // Regular text/json response
      try {
        const textData = Buffer.from(response.data).toString('utf-8');
        try {
          returnData = JSON.parse(textData);
        } catch (e) {
          returnData = textData;
        }
      } catch (err) {
        returnData = response.data; // Fallback to raw buffer
      }
    }

    ctx.body = {
      success: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: returnData,
        duration
      }
    };

    // Async DB Logging
    pool.query(
      `INSERT INTO proxy_requests 
      (req_method, req_url, req_headers, req_body, res_status, res_headers, res_body, duration_ms, client_ip, error_msg) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        method || 'GET',
        url,
        safeStringify(reqHeaders),
        safeStringify(finalData),
        response.status,
        safeStringify(response.headers),
        safeStringify(returnData),
        duration,
        ctx.request.ip,
        null
      ]
    ).catch(err => console.error("DB Log Error:", err.message));

  } catch (error) {
    const duration = Date.now() - startTime;
    let errorData = error.message;

    // Best effort mapping error text if it failed
    if (error.response && error.response.data) {
      errorData = Buffer.from(error.response.data).toString('utf-8');
      try { errorData = JSON.parse(errorData); } catch (e) { }
    }

    ctx.body = {
      success: false,
      message: error.message,
      data: {
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Internal Server Error',
        headers: error.response?.headers || {},
        data: errorData,
        duration
      }
    };

    // Async DB Error Logging
    pool.query(
      `INSERT INTO proxy_requests 
      (req_method, req_url, req_headers, req_body, res_status, res_headers, duration_ms, client_ip, error_msg) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        method || 'GET',
        url,
        safeStringify(reqHeaders),
        safeStringify(finalData),
        error.response?.status || null,
        safeStringify(error.response?.headers || {}),
        duration,
        ctx.request.ip,
        error.message
      ]
    ).catch(err => console.error("DB Log Error:", err.message));
  }
});


// ==========================================
// Feedback Endpoint
// ==========================================
router.post('/api/feedback', async (ctx) => {
  const { email, content } = ctx.request.body;
  if (!content) {
    ctx.status = 400;
    ctx.body = { success: false, message: '内容不能为空 / Content cannot be empty' };
    return;
  }

  try {
    await pool.query(
      `INSERT INTO feedbacks (email, content, client_ip) VALUES (?, ?, ?)`,
      [email || null, content, ctx.request.ip]
    );

    ctx.body = {
      success: true,
      message: '感谢您的反馈！ / Thank you for your feedback!'
    };
  } catch (err) {
    console.error("DB Feedback Error:", err.message);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '数据库写入失败 / Database insertion failed'
    };
  }
});

// ==========================================
// Mock Endpoints for Testing
// ==========================================

/**
 * @swagger
 * /api/mock/get:
 *   get:
 *     summary: Simple GET endpoint
 *     description: Returns success message and query parameters.
 *     parameters:
 *       - in: query
 *         name: example
 *         schema:
 *           type: string
 *         description: Example query param
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/mock/get', (ctx) => {
  ctx.body = {
    message: 'GET request successful',
    query: ctx.query,
    headers: ctx.headers
  };
});

/**
 * @swagger
 * /api/mock/post:
 *   post:
 *     summary: Simple POST endpoint
 *     description: Echoes back the JSON payload.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/api/mock/post', (ctx) => {
  ctx.body = {
    message: 'POST request successful',
    receivedBody: ctx.request.body,
    headers: ctx.headers
  };
});

/**
 * @swagger
 * /api/mock/put:
 *   put:
 *     summary: Simple PUT endpoint
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/api/mock/put', (ctx) => {
  ctx.body = {
    message: 'PUT request successful',
    receivedBody: ctx.request.body
  };
});

/**
 * @swagger
 * /api/mock/delete:
 *   delete:
 *     summary: Simple DELETE endpoint
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/api/mock/delete', (ctx) => {
  ctx.body = {
    message: 'DELETE request successful'
  };
});

/**
 * @swagger
 * /api/mock/form:
 *   post:
 *     summary: Form-Data POST endpoint
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               field1:
 *                 type: string
 *               field2:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/api/mock/form', upload.any(), (ctx) => {
  ctx.body = {
    message: 'Form-Data parsed successfully',
    receivedFields: ctx.request.body || {}
  };
});

/**
 * @swagger
 * /api/mock/auth:
 *   get:
 *     summary: Auth endpoint
 *     security:
 *       - bearerAuth: []
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Authorized
 *       401:
 *         description: Unauthorized
 */
router.get('/api/mock/auth', (ctx) => {
  const authHeader = ctx.headers.authorization;
  if (!authHeader) {
    ctx.status = 401;
    ctx.body = { error: 'Missing Authorization header' };
    return;
  }
  ctx.body = {
    message: 'Authentication successful',
    tokenProvided: authHeader
  };
});

/**
 * @swagger
 * /api/mock/delay:
 *   get:
 *     summary: Delayed response endpoint
 *     parameters:
 *       - in: query
 *         name: ms
 *         schema:
 *           type: integer
 *         description: Delay in milliseconds
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/mock/delay', async (ctx) => {
  const ms = parseInt(ctx.query.ms, 10) || 1000;
  await new Promise(resolve => setTimeout(resolve, ms));
  ctx.body = {
    message: `Responded after ${ms}ms delay`
  };
});

/**
 * @swagger
 * /api/mock/status/{code}:
 *   get:
 *     summary: Return specific HTTP status code
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       default:
 *         description: Returns the requested status code
 */
router.get('/api/mock/status/:code', (ctx) => {
  const code = parseInt(ctx.params.code, 10);
  ctx.status = code || 200;
  ctx.body = {
    message: `Returned status code ${code}`
  };
});


app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Nebula Proxy Server running on http://localhost:${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});
