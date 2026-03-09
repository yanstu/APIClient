import { parseCurl } from './src/utils/curlParser.js';

const cmd1 = String.raw`curl ^"http://localhost:3000/api/proxy^" ^
  -H ^"Accept: */*^" ^
  --data-raw ^"^{^\^"method^\^":^\^"GET^\^"^}^"`;

console.log("CMD1:\n", parseCurl(cmd1));
