'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import {parseCoordinates,validRadiusMiles,type SearchArea,type SearchCenter} from '@/lib/radius';

type Props = {
  active: SearchArea | null;
  excludedCount: number;
  resultCount: number;
  onApply: (center: SearchCenter, miles: number) => void;
  onClear: () => void;
};

export default function RadiusFilter({active,excludedCount,resultCount,onApply,onClear}: Props) {
  const [location,setLocation]=useState('');
  const [miles,setMiles]=useState('25');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);

  function cancelLookup() {
    request.current?.abort();
    request.current=null;
    setBusy(false);
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancelLookup();
    const input=location.trim();
    const distance=validRadiusMiles(miles);
    if(!input){setError('Enter an address or latitude, longitude.');return}
    if(distance===null){setError('Enter a radius greater than 0 and at most 12,500 miles.');return}
    const coordinates=parseCoordinates(input);
    if(coordinates){
      onApply({...coordinates,label:input,precision:'Entered coordinates'},distance);
      setError('');
      return;
    }
    if(/^[\d+.,\-\s]+$/.test(input)){
      setError('Use latitude, longitude (for example: 30.2672, -97.7431). Latitude must be -90 to 90; longitude -180 to 180.');
      return;
    }
    setError('');
    if(active?.center.label===input){onApply(active.center,distance);return}
    const controller=new AbortController();
    request.current=controller;
    setBusy(true);
    try{
      const response=await fetch('/api/geocode?address='+encodeURIComponent(input),{signal:controller.signal});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Address lookup failed.');
      if(!parseCoordinates(result.latitude+', '+result.longitude))throw new Error('The address service returned an invalid location.');
      if(controller.signal.aborted)return;
      setLocation(result.label);
      onApply(result as SearchCenter,distance);
    }catch(reason){
      if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Address lookup failed.');
    }finally{
      if(request.current===controller){request.current=null;setBusy(false)}
    }
  }

  function clear() {
    cancelLookup();setLocation('');setMiles('25');setError('');onClear();
  }

  return <section className="radius-filter" aria-label="Location and radius search">
    <div className="radius-heading"><strong>Search near a location</strong><span>Find properties within your chosen distance</span></div>
    <form onSubmit={apply}>
      <label className="radius-location"><span>Address or coordinates</span>
        <input aria-label="Search center address or coordinates" value={location} onChange={event=>{cancelLookup();setLocation(event.target.value);setError('')}} placeholder="Austin, TX or 30.2672, -97.7431" maxLength={200}/>
      </label>
      <label className="radius-miles"><span>Radius (miles)</span>
        <input aria-label="Radius in miles" type="number" min="0.01" max="12500" step="any" value={miles} onChange={event=>{cancelLookup();setMiles(event.target.value);setError('')}}/>
      </label>
      <button className="primary" type="submit" disabled={busy}>{busy?'Finding location…':'Search radius'}</button>
      {(active||busy)&&<button className="secondary" type="button" onClick={clear}>{busy?'Cancel':'Clear radius'}</button>}
    </form>
    <div className="radius-presets" role="group" aria-label="Radius presets">
      {[5,10,25,50,100].map(value=><button key={value} type="button" aria-pressed={Number(miles)===value} onClick={()=>{cancelLookup();setMiles(String(value));setError('');if(active&&location.trim()===active.center.label)onApply(active.center,value)}}>{value} mi</button>)}
      <small>Straight-line distance · Address lookup by Esri</small>
    </div>
    {error&&<p className="radius-error" role="alert">{error}</p>}
    {active&&<p className="radius-active" role="status"><b>{resultCount.toLocaleString()} {resultCount===1?'property':'properties'} within {active.miles} mi</b> of {active.center.label}. {active.center.precision!=='Entered coordinates'&&'Address match: '+active.center.precision+'. '}Other filters also apply.{excludedCount>0&&' '+excludedCount.toLocaleString()+' properties without valid coordinates are excluded.'}</p>}
  </section>;
}
