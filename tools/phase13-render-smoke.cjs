/* Dependency-free JSX layout smoke test; NOT a substitute for React/browser testing. */
const fs = require('node:fs')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('typescript')
const jsx = (type, props, key) => ({ type, props: { ...(props || {}), ...(key === undefined ? {} : { key }) } })
require.extensions['.ts'] = require.extensions['.tsx'] = (mod, file) => {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  mod._compile(output, file)
}
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
  if (request === 'react') return {}
  if (request === 'react-router-dom') return { Link: 'a' }
  if (request === '@phosphor-icons/react') return new Proxy({}, {get:(_,key)=>key === '__esModule' ? false : (props)=>jsx('span',{'aria-hidden':'true',...(props||{})})})
  if (/I18nContext$/.test(request)) return { useI18n: () => ({ t: key => key, locale:'en' }) }
  if (/SvgCharacter$/.test(request)) return { SvgCharacter: props => jsx('span', { 'aria-hidden':'true', 'data-svg':props.id }) }
  return originalLoad.call(this,request,parent,isMain)
}
const { AnalysisDashboard } = require('../src/components/analysis/AnalysisDashboard.tsx')
function materialize(node) {
  if (Array.isArray(node)) return node.flatMap(materialize)
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (typeof node !== 'object' || !('type' in node)) return [String(node)]
  if (typeof node.type === 'function') return materialize(node.type(node.props))
  return [node, ...materialize(node.props?.children)]
}
const fixture = {
  days:30, onDaysChange:()=>{},
  today:{ completed:5, skipped:1, rescheduled:1, roomsMaintained:4, everythingHandled:false, plannedCount:10 },
  outcomes:{completed:48, skipped:6, rescheduled:9},
  trend:Array.from({length:30},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,regular:i*2.1,deep:i+11})),
  historyGroups:[['2026-09-30',[{id:'event-test',at:'2026-09-30T14:00:00.000Z',taskId:'task-original-id',type:'completed',activity:'Cucina · Pulire Superfici',room:'Kitchen',routine:'Every 3 days',actor:'You',health:[]}]]],
  timezone:'Europe/Rome',now:new Date('2026-09-30T16:00:00.000Z'),
}
const elements = materialize(AnalysisDashboard(fixture))
const periodButtons = elements.filter(el=>typeof el==='object' && el.type === 'button')
assert.equal(periodButtons.length,3)
assert.equal(periodButtons.filter(el=>el.props['aria-pressed'] === true).length,1)
assert.ok(periodButtons.find(el=>el.props['aria-pressed'] && el.props.children.some?.(v=>String(v)==='30')))
const links=elements.filter(el=>typeof el==='object' && el.type==='a')
assert.equal(links.length,1)
assert.equal(links[0].props.to,'/task/task-original-id')
assert.equal(elements.filter(el=>typeof el==='object' && el.type === 'svg' && el.props.role === 'img').length,2)
assert.equal(elements.filter(el=>typeof el==='object' && el.type === 'details').length,1)
const bars=elements.filter(el=>typeof el==='object' && el.type==='span' && /v2-outcome-segment/.test(el.props.className||''))
assert.equal(bars.length,3)
assert.equal(Math.round(bars.reduce((total,el)=>total+parseFloat(el.props.style.width),0)),100)
assert.ok(elements.some(el=>typeof el==='object' && el.type==='strong' && el.props.children===48))
assert.ok(elements.some(el=>typeof el==='object' && el.type==='strong' && el.props.children===5))
console.log('Phase 13 JSX smoke passed: 3 periods, 4 today counts, 3 period outcomes, 2 accessible trend charts, 1 exact task history link')
