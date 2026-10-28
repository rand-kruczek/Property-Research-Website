import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function loadTypeScript(file) {
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
}
const {parseCoordinates,validRadiusMiles,propertyCoordinates,distanceMiles,filterByRadius}=await loadTypeScript('../lib/radius.ts');
const {selectProperties}=await loadTypeScript('../lib/properties.ts');
const center={latitude:30.2672,longitude:-97.7431,label:'Austin, TX',precision:'Entered coordinates'};
const area={center,miles:25};
const parks=[
  {id:'far',name:'Dallas',latitude:32.7767,longitude:-96.797,type:'RV Park',county:'Dallas',status:'Not Contacted'},
  {id:'near',name:'Austin',latitude:30.2672,longitude:-97.7431,type:'RV Park',county:'Travis',status:'Contacted'},
  {id:'missing',name:'Missing coordinates',latitude:'',longitude:'',type:'RV Park',county:'Travis',status:'Contacted'},
  {id:'invalid',name:'Invalid coordinates',latitude:'bad',longitude:-97.7},
  {id:'other',name:'Nearby MHC',latitude:30.3,longitude:-97.7,type:'Mobile Home Park',county:'Travis',status:'Contacted'},
];
test('accepts comma or space separated coordinates and valid limits',()=>{
  assert.deepEqual(parseCoordinates('30.2672, -97.7431'),{latitude:30.2672,longitude:-97.7431});
  assert.deepEqual(parseCoordinates('30.2672 -97.7431'),{latitude:30.2672,longitude:-97.7431});
  assert.deepEqual(parseCoordinates('-90, 180'),{latitude:-90,longitude:180});
});
test('rejects addresses, incomplete coordinates and out of range values',()=>{
  for(const value of ['Austin, TX','91, -97','30, -181','30,','NaN, 0','30, -97, 2'])assert.equal(parseCoordinates(value),null);
});
test('validates custom distances',()=>{
  for(const value of ['', '0','-1','NaN','Infinity','12501'])assert.equal(validRadiusMiles(value),null);
  assert.equal(validRadiusMiles('0.01'),.01);assert.equal(validRadiusMiles('12500'),12500);
});
test('excludes blank, missing and invalid locations but accepts zero',()=>{
  for(const p of [{latitude:' ',longitude:2},{latitude:null,longitude:2},{latitude:91,longitude:2},{latitude:'bad',longitude:2}])assert.equal(propertyCoordinates(p),null);
  assert.deepEqual(propertyCoordinates({latitude:0,longitude:0}),{latitude:0,longitude:0});
});
test('distance is symmetric and stable at the same point and antipodes',()=>{
  assert.equal(distanceMiles(center,center),0);
  const d=distanceMiles(center,parks[0]);assert.ok(d>180&&d<190);assert.equal(d,distanceMiles(parks[0],center));
  assert.ok(Number.isFinite(distanceMiles({latitude:0,longitude:0},{latitude:0,longitude:180})));
});
test('radius filters and sorts nearest first without mutating inputs',()=>{
  const original=parks.map(p=>p.id);
  assert.deepEqual(filterByRadius(parks,area,true).map(p=>p.id),['near','other']);
  assert.deepEqual(parks.map(p=>p.id),original);
  assert.equal(filterByRadius(parks,null),parks);
  assert.deepEqual(filterByRadius(parks,{center,miles:.01},true).map(p=>p.id),['near']);
});
test('includes points exactly on the boundary and handles empty results',()=>{
  const miles=distanceMiles(center,parks[4]);
  assert.ok(filterByRadius(parks,{center,miles}).some(p=>p.id==='other'));
  assert.deepEqual(filterByRadius(parks,{center:{...center,latitude:0,longitude:0},miles:1}),[]);
});
test('radius composes with status, county, type and text filters',()=>{
  const filtered=selectProperties(parks,'Austin',['RV Park'],'Travis',['Contacted']);
  assert.deepEqual(filterByRadius(filtered,area,true).map(p=>p.id),['near']);
  assert.deepEqual(filterByRadius(selectProperties(parks,'',['Mobile Home Park'],'Travis',['Contacted']),area,true).map(p=>p.id),['other']);
});
