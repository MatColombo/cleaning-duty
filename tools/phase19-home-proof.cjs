/** Dev-only real component SVG proof, no React DOM/browser, no runtime media storage. */
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const vm=require('node:vm')
const {spawnSync}=require('node:child_process')
const ts=require('typescript')
const root=path.join(__dirname,'..')
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hc-19-proof-'))
const escape=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const attr=(key)=>({className:'class',strokeWidth:'stroke-width',strokeLinecap:'stroke-linecap',strokeLinejoin:'stroke-linejoin',strokeDasharray:'stroke-dasharray',fillRule:'fill-rule',clipPath:'clip-path',pointerEvents:'pointer-events',tabIndex:'tabindex',ariaHidden:'aria-hidden'}[key]||key)
const Fragment=Symbol('fragment')
const jsx=(type,props)=>({type,props:props??{}})
const runtime={jsx,jsxs:jsx,Fragment}
const html=(node)=>{
  if(node==null||node===false||node===true)return ''
  if(Array.isArray(node))return node.map(html).join('')
  if(typeof node!=='object')return escape(node)
  if(node.type===Fragment)return html(node.props.children)
  const props=node.props||{}
  const attrs=Object.entries(props).filter(([key,value])=>key!=='children'&&key!=='key'&&value!=null&&typeof value!=='function'&&value!==false)
    .map(([key,value])=>` ${attr(key)}="${escape(value===true?'true':value)}"`).join('')
  return `<${node.type}${attrs}>${html(props.children)}</${node.type}>`
}
function loadTsx(file,lib){
  const source=fs.readFileSync(path.join(root,file),'utf8')
  const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  const imports=(name)=>name==='react/jsx-runtime'?runtime:name.includes('homeIllustration')?lib: (()=>{throw new Error(`Unexpected proof import: ${name}`)})()
  vm.runInNewContext('(function(require,module,exports){'+code+'})',{console})(imports,module,module.exports)
  return module.exports
}
try{
  const out=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck','--rootDir',path.join(root,'src'),'--outDir',tmp,path.join(root,'src/lib/homeIllustration.ts')],{cwd:root,encoding:'utf8'})
  if(out.status!==0)throw new Error(out.stderr||out.stdout)
  const lib=require(path.join(tmp,'lib/homeIllustration.js'))
  const {IllustratedElement}=loadTsx('src/components/home/IllustratedElement.tsx',lib)
  const {SceneDecorationMark}=loadTsx('src/components/home/SceneDecorationMark.tsx',lib)
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/pre-v2-household-backup.json'),'utf8')).data
  const scene=fixture.layoutScenes[0]
  const areas=fixture.layoutElements.map(element=>({...element}))
  const semantic=[['Oven','Kitchen','oven','object',70,81,110,98],['Sofa','Living room','sofa','object',505,74,154,96],['Shower','Bathroom','shower','object',64,374,118,92]]
  const objects=semantic.map(([name,_,id,role,x,y,width,height],i)=>({id:`proof-object-${i}`,role,entityId:`proof-entity-${i}`,sceneId:scene.id,shape:'rect',x,y,width,height,rotation:0}))
  const display=[...areas,...objects]
  const names=['Kitchen','Living room','Bathroom','Oven','Sofa','Shower']
  const types=['Room','Room','Room','Appliance','Furniture','Fixture']
  const statuses=['3 tasks overdue','Ready','Due today','','','']
  const ink='#153D3A'
  const stroke='#31574D'
  function renderElement(element,i,illustrated){
    const area=element.role==='area'
    const fill=area?['#F6DFB7','#E4F0E1','#F2E8D4'][i]:'#FFF9EC'
    const rect=`<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${area?13:9}" fill="${fill}" stroke="${stroke}" stroke-width="${area?5:2.8}"/>`
    const entity={name:names[i]}
    const type={name:types[i]}
    const recipe=lib.illustratedElementRecipe(scene,element,entity,type)
    const art=illustrated?html(IllustratedElement({element,recipe,zoom:1.25})):''
    const labelY=area?element.y+element.height*.53:element.y+element.height+20
    const label=`<text x="${element.x+element.width/2}" y="${labelY}" text-anchor="middle" font-family="Georgia,serif" font-size="${area?28:19}" font-weight="bold" fill="${ink}">${escape(names[i])}</text>`
    const status=statuses[i]?`<text x="${element.x+element.width/2}" y="${labelY+27}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="600" fill="#99452E">${escape(statuses[i])}</text>`:''
    const handles=!illustrated?`<circle cx="${element.x+element.width}" cy="${element.y+element.height}" r="11" fill="#FFF9EC" stroke="${stroke}" stroke-width="3"/>`:''
    return `${rect}${art}${label}${status}${handles}`
  }
  const decorationProps=[
    {id:'proof-a',kind:'plant',ink:'teal',layer:'above',x:520,y:550,scale:1.5,rotation:0},
    {id:'proof-b',kind:'picture',ink:'coral',layer:'above',x:860,y:190,scale:1.1,rotation:0},
    {id:'proof-c',kind:'rug',ink:'mustard',layer:'above',x:470,y:400,scale:1.2,rotation:0},
  ]
  function sceneBody(mode){
    const illustrated=mode!=='edit'
    const elements=display.map((element,i)=>renderElement(element,i,illustrated)).join('')
    const custom=mode==='saved'?decorationProps.map(item=>html(SceneDecorationMark({item}))).join(''):''
    const grid=mode==='edit'?Array.from({length:50},(_,i)=>`<path d="M${i*20} 0V700" stroke="${ink}" stroke-opacity=".08" stroke-width=".7"/>`).join('')+Array.from({length:35},(_,i)=>`<path d="M0 ${i*20}H1000" stroke="${ink}" stroke-opacity=".08" stroke-width=".7"/>`).join(''):''
    return `<rect width="1000" height="700" fill="#FFF9EC"/>${grid}${elements}${custom}`
  }
  const modes=[['Edit Mode','Precise geometry, resize handles','edit'],['Illustrated Mode','Deterministic default, no writes','illustrated'],['Saved Decorations','Explicit curated props, CAS draft','saved']]
  const css=`<style>.v2-home-illustration{pointer-events:none;fill:none;stroke:#153D3A;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round;opacity:.39}.v2-object-print{stroke-width:3.8;opacity:.67}.v2-scene-decoration{pointer-events:none;opacity:.72}.v2-scene-ink-teal{color:#1F6B63}.v2-scene-ink-coral{color:#C65E48}.v2-scene-ink-mustard{color:#C38A32}.v2-scene-ink-ink{color:#153D3A}</style>`
  const panelW=494, panelH=420, outerW=1550, outerH=565
  const panels=modes.map(([title,caption,mode],i)=>{
    const x=20+i*510
    return `<g transform="translate(${x} 75)"><rect x="-8" y="-8" width="${panelW+16}" height="${panelH+16}" rx="17" fill="#FFE8BC" stroke="#153D3A" stroke-opacity=".24" stroke-width="2"/><svg x="0" y="0" width="${panelW}" height="${panelH}" viewBox="0 0 1000 700">${sceneBody(mode)}</svg></g><text x="${x}" y="49" font-family="Georgia,serif" font-size="25" font-weight="bold" fill="${ink}">${title}</text><text x="${x}" y="527" font-family="sans-serif" font-size="16" fill="#355D54">${caption}</text>`
  }).join('')
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outerW} ${outerH}" width="${outerW}" height="${outerH}">${css}<rect width="${outerW}" height="${outerH}" fill="#F4E8D0"/>${panels}<text x="24" y="552" font-family="sans-serif" font-size="12" fill="#355D54">19A/19B isolated rendering proof from actual V2 SVG components; demo placement fixture, NOT a running-app screenshot.</text></svg>`
  const outDir=path.join(root,'design/v2/page-reference')
  fs.writeFileSync(path.join(outDir,'v2-phase19-home-comparison.svg'),svg)
  console.log('19A/19B comparison SVG from actual React vector component output: '+Buffer.byteLength(svg)+' bytes')
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
