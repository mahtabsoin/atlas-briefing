'use client';
import {useEffect} from 'react';
import {markup} from './player-markup';
export default function Player(){
 useEffect(()=>{const script=document.createElement('script');script.type='module';script.src='/app.js';document.body.appendChild(script);return()=>script.remove()},[]);
 return <div dangerouslySetInnerHTML={{__html:markup}}/>;
}
