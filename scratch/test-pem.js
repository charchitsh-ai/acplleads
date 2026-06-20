const crypto = require('crypto');

const private_key = `-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDQBhVQoC2Wffnp\\nBNPUdupL8+C3MI76t77SoA30fq5IR8GLzhU65lyDa19Y3RgsiKl81kesAUfG0/9x\\nbt0BrQlRGgmL+Twh7ekxTTVU4T+7fL7QBbcQNBvunxvC2CB+5Zfb2esH66PDyczN\\n9O6tY9azqUPYJgkFworu2w4YI75C3+0L9vAaW/tunjrnLxqSterXksUrR8ekNkzk\\nWEW/c/CKUJbYrPkmHQLlQVw5sN6WNchrz0GqEzY0g2bojHfJqeaUiRCGcdXdUZxk\\nNGTKAGZoco4mnsm03AMzeg78BaW/TsbD/5R20VEyaSRgySXP6qCtjnjv3Vk7rmV1\\nDOg7rZg1AgMBAAECggEAXg8yGhejJVXm5y7wnTP7ssYeCJbjP4hPtyr5xGB3a2VO\\npWlUfiJlGGM3ZJXr9U8B29mD5MlbbBK1gNPRCI32FX7BbFIQl4Lcmxc/ExcaWysH\\nmEXNRX1aV+YHhm11HAuyQ41gUV+B1+hqO4IRXcMz9F6Ht7dTAxC5A1F3KQEYaWHH\\n5imGxlVPMW4pF6jqzlLrKFdEREK5tMy/ShZB0Nl1T2PrVZjHvOeDmw4QVxTbxarD\\nqHbarJ94rkfOBdOkty4F/HlPtyAF3EoIDk0Rb0hwE5idBVj7BfYLIAtvO32Khq3J\\n1pnF5+N3zf4BpoOiqJrqaDUXeHF/upW7MyXgMINw7QKBgQD0Mar3X3nflG3dWqnV\\nlhF+L1rYK7Mc6oDlkg7Zc9VNSaVCNWSS1vtGchF+TMfND9Kh3vfO1Biz+FVJNf6z\\nNQgAgA9eoQHEnLd7dr2lc5ZMeTrGuL3znHN4XmA3fOrZfbYyedGjEcTJLot9+UHm\\n0xJ/XlR8YJd7I0JU4Gu/b8x26wKBgQDaFL6jSF9Rc3WV2db28tSrUEum7DiDyOsC\\nB8d5zBjGVkPLXABUf4i1dMDlMr8cKebo+lhpHxkSKcrILtrXLFyaj+GT1CUL2atK\\nlzgvmTrO539OBE0CyRWW+DATgyz0+omRnfAm/n3wNwcYLzVE18TvIgx81fddAq6w\\n06aHqHilXwKBgCi7sD0bXAUDiWAHI5VRNxHJbGnqwDHunBmvR3LWc5o00rA8n84u\\ntjOGC4z52cpG/Weq/cMudgBvSCqyKw5RpkgPFIFAcj8NtT2PDQtwQH35KujDIExm\\nqIxHkd0vpS0qXx4EXAfLivvUG8ijr26FfuxoG8ezhRExTHtEBDUmvQCJAoGBAI/h\\n1fFW44SSv8axZfGiPwwUOwWTnqncGqlJRqOmM8ZPzgTS22jkh+bodAgEFjDXuICI\\nA2K/4MOqDR9MQphqrWJQgY0OD68k2q2o3aoR18oA1G49yi2HTBZCAz4scrHixnbr\\nlDG2AJNHSwf6xZN5JHZ9qW2Hod+c0HLcAWhJj+fTAoGAHob4uG1kQTTsNxniFEEe\\ncaGFC/308p7AKQT7k+neajOetjyT2R28BQxtkyQ2MF4CLmeffvVF8crLTroFrwCZ\\naw6vbJCAFYroWwFkNcQKwRe5sYsIIG8YBt/CWJFVUieqWpPkeggT/kAuszXApTl3\\nNDn+4X92Zzzn46TWaK3x35I=\\n-----END PRIVATE KEY-----\\n`;

let cleanKey = private_key;

// 1. Remove standard headers/footers
cleanKey = cleanKey
  .replace(/-----BEGIN PRIVATE KEY-----/g, '')
  .replace(/-----END PRIVATE KEY-----/g, '');

// 2. Remove escaped backslash-n, backslash-r, backslash-t and backslashes
cleanKey = cleanKey
  .replace(/\\n/g, '')
  .replace(/\\r/g, '')
  .replace(/\\t/g, '')
  .replace(/\\/g, '');

// 3. Strip all remaining whitespace, newlines, and quotes
cleanKey = cleanKey.replace(/[\s\r\n"']/g, '');

// 4. Reconstruct the PEM key with 64-character chunks per line
const chunks = [];
for (let i = 0; i < cleanKey.length; i += 64) {
  chunks.push(cleanKey.substring(i, i + 64));
}
const formattedPrivateKey = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;

console.log('Reconstructed Key Length:', formattedPrivateKey.length);
console.log('Key Content:\n', formattedPrivateKey);

try {
  crypto.createPrivateKey(formattedPrivateKey);
  console.log('[Success] Key is valid and accepted by OpenSSL!');
} catch (e) {
  console.error('[Error] Key is invalid:', e.message);
}
