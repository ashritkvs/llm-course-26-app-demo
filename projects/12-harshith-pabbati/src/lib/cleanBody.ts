import { JSDOM } from 'jsdom';

export function cleanBody(body: string) {
  const dom = new JSDOM(body);
  const textContent = dom.window.document.body.textContent || '';
  return textContent.trim();
}
