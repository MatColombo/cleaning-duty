/** Phase 19A: derived art must not alter any geometry/mutation source. */
declare const require: (name: string) => any
import { illustratedElementRecipe, homeIllustrationDetail, HOME_ILLUSTRATION_GENERATOR } from '../src/lib/homeIllustration'
import type { LayoutElement, LayoutScene, Entity, EntityType } from '../src/types/domain'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const scene={id:'scene-1',kind:'floor'} as LayoutScene
const obj={id:'obj-1',role:'object',x:112,y:143,width:90,height:75,rotation:17,points:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]} as LayoutElement
const room={...obj,id:'room-1',role:'area',width:340,height:260} as LayoutElement
const type={name:'Appliance'} as EntityType
const entity={name:'Kitchen sink'} as Entity
const geometryBefore=JSON.stringify([scene,obj,room,type,entity])
const a=illustratedElementRecipe(scene,obj,entity,type)
assert.deepEqual(a,illustratedElementRecipe({...scene},{...obj},{...entity},{...type}))
assert.ok(['sink','oven','generic'].includes(a.silhouette))
assert.equal(illustratedElementRecipe(scene,obj,{name:'Kitchen sink renamed'},{name:'Thing'}).seed, a.seed, 'Artwork seed must survive routine/entity label edits')
assert.equal(HOME_ILLUSTRATION_GENERATOR,1)
assert.equal(homeIllustrationDetail(.75),'minimal')
assert.equal(homeIllustrationDetail(1),'normal')
assert.equal(homeIllustrationDetail(2),'rich')
assert.equal(homeIllustrationDetail(2,true),'minimal')
assert.ok(illustratedElementRecipe(scene,room,{name:'Unrecognized custom room'}).motif)
assert.equal(JSON.stringify([scene,obj,room,type,entity]),geometryBefore,'Art projection may not change layout state')
const canvas=readFileSync('src/components/HomeLayoutCanvas.tsx','utf8')
const page=readFileSync('src/pages/HomePage.tsx','utf8')
const art=readFileSync('src/components/home/IllustratedElement.tsx','utf8')
assert.ok(canvas.includes('illustrated && !editMode && !compact') && canvas.includes('onGeometryCommit('))
assert.ok(canvas.includes('onPointerMove={moveInteraction}') && canvas.includes('onPointerCancel={endInteraction}'))
assert.ok(art.includes('pointerEvents="none"') && !art.includes('onPointerDown') && !art.includes('supabase'))
assert.ok(page.includes('Illustrated Mode') && page.includes('Modalità illustrata'))
const css=readFileSync('src/styles/home-v2.css','utf8')
assert.ok(css.includes('body[data-v2-no-art="true"] .v2-home-illustration') && css.includes('prefers-reduced-motion:reduce'))
assert.ok(css.includes('body[data-v2-no-art="true"] .home-layout-canvas.illustrated .object-icon'), 'No-art users must retain semantic object icons')
console.log('Phase 19A pure composition, scene fallback, zoom detail, geometry isolation and accessibility contracts passed')
