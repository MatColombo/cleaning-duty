/** Isolated Node+TypeScript procedural rendering benchmark; NOT an app/browser frame benchmark. */
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const vm=require('node:vm')
const {performance}=require('node:perf_hooks')
const {spawnSync}=require('node:child_process')
const ts=require('typescript')
const root=path.resolve(__dirname,'..')
const build=fs.mkdtempSync(path.join(os.tmpdir(),'hc-19a-bench-'))
const V=['oven','sofa','kitchen sink','wardrobe','washer','shower','plant','undefined']
try{
 const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'), '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck','--rootDir',path.join(root,'src'),'--outDir',build,path.join(root,'src/lib/homeIllustration.ts')],{encoding:'utf8',cwd:root})
 if(result.status!==0)throw new Error(result.stderr||result.stdout)
 const pure=require(path.join(build,'lib/homeIllustration.js'))
 const source=fs.readFileSync(path.join(root,'src/components/home/IllustratedElement.tsx'),'utf8')
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const jsx=(type,props)=>({type,props:props||{}})
 const module={exports:{}}
 const load=(name)=>name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:pure
 vm.runInNewContext('(function(require,module,exports){'+code+'})',{console})(load,module,module.exports)
 const escape=(x)=>String(x).replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]))
 const serialize=(item)=>{
  if(item===null||item===undefined||item===false)return ''
  if(Array.isArray(item))return item.map(serialize).join('')
  if(typeof item!=='object')return escape(item)
  const attrs=Object.entries(item.props||{}).filter(([name,value])=>name!=='children'&&name!=='key'&&value!==undefined&&value!==false&&typeof value!=='function').map(([name,value])=>' '+name+'=\"'+escape(value)+'\"').join('')
  return '<'+item.type+attrs+'>'+serialize(item.props.children)+'</'+item.type+'>'
 }
 const scene={id:'scene',kind:'floor'}
 const getCase=(i)=>{
  const element={id:`element-${i}`,role:i%3?'object':'area',x:20,y:20,width:100+(i%4)*100,height:90+(i%5)*44}
  return {element,entity:{name:V[i%V.length]},type:{name:i%2?'Appliance':'Furniture'}}
 }
 const iterations=10000
 const first=performance.now()
 const recipes=[]
 for(let i=0;i<iterations;i++){
  const q=getCase(i)
  recipes.push(pure.illustratedElementRecipe(scene,q.element,q.entity,q.type))
 }
 const generateMs=performance.now()-first
 const renderStart=performance.now()
 let checksum=0,totalBytes=0,maxBytes=0,maxPaths=0
 for(let i=0;i<1000;i++){
  const q=getCase(i), markup=serialize(module.exports.IllustratedElement({element:q.element,recipe:recipes[i],zoom:1.5}))
  const bytes=Buffer.byteLength(markup)
  totalBytes+=bytes
  maxBytes=Math.max(bytes,maxBytes)
  maxPaths=Math.max((markup.match(/<path\b/g)||[]).length,maxPaths)
  checksum+=markup.length
 }
 const renderMs=performance.now()-renderStart
 const report={context:'Isolated Node pure recipe + JSX shape benchmark. No React DOM, browser, device GPU, memory, cloud or touch.',node:process.version,recipeIterations:iterations,recipeMs:Number(generateMs.toFixed(3)),recipeAvgUs:Number((generateMs*1000/iterations).toFixed(3)),renderIterations:1000,renderMs:Number(renderMs.toFixed(3)),renderAvgUs:Number((renderMs).toFixed(3)),illustrationMarkupAvgBytes:Math.round(totalBytes/1000),illustrationMarkupMaxBytes:maxBytes,maxPathElementsPerIllustration:maxPaths,renderedChecksum:checksum,appDomNodeCount:'NOT MEASURED',browserFps:'NOT MEASURED',pwaDevice:'NOT RUN'}
 const output=process.argv[2]
 if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report,null,2))
}finally{fs.rmSync(build,{recursive:true,force:true})}
