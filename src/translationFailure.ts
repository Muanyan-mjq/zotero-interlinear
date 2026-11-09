// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — detects failure strings returned by upstream services.

export function isFailureText(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  return (
    /^\[请求错误\]/u.test(value) ||
    /此翻译服务不可用/u.test(value) ||
    /(?:request|service|parse) error\s*:/iu.test(value) ||
    /HTTP\s+(?:GET|POST)?[^\n]*failed with status code/iu.test(value) ||
    /翻译请求失败/u.test(value) ||
    /翻译未返回译文/u.test(value) ||
    /未返回有效译文/u.test(value)
  );
}
