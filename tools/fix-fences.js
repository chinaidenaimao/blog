// 修复被粘连的代码围栏：`#### 标题```html<style>` → 标题 / ```html / <style>
const fs = require('fs');
const path = require('path');

const dir = 'source/_posts';
let totalFixed = 0;

for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
  const p = path.join(dir, f);
  const raw = fs.readFileSync(p, 'utf8');
  const lines = raw.split('\n');
  const out = [];
  let fixed = 0;

  for (const line of lines) {
    const idx = line.indexOf('```');
    if (idx > 0) {
      // 围栏前面有内容 → 拆行
      const before = line.slice(0, idx).replace(/\s+$/, '');
      const rest = line.slice(idx);
      const m = rest.match(/^```([A-Za-z]*)(.*)$/);
      const lang = m ? m[1] : '';
      const tail = m ? m[2] : '';
      if (before) out.push(before);
      out.push('```' + lang);
      if (tail.trim()) out.push(tail.replace(/^\s+/, ''));
      fixed++;
      continue;
    }
    // 围栏开头但语言标记后面粘了内容：```html<style>
    const m = line.match(/^```([A-Za-z]*)(\S.*)$/);
    if (m) {
      out.push('```' + m[1]);
      out.push(m[2]);
      fixed++;
      continue;
    }
    out.push(line);
  }

  if (fixed) {
    fs.writeFileSync(p, out.join('\n'));
    // 校验围栏是否成对
    const fences = (out.join('\n').match(/^```/gm) || []).length;
    console.log(`  ${f}: 修复 ${fixed} 处，围栏总数 ${fences} ${fences % 2 ? '⚠ 奇数' : '✓'}`);
    totalFixed += fixed;
  }
}

console.log(`\n共修复 ${totalFixed} 处`);
