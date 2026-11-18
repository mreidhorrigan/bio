/*! Copyright (c) 2026 M. Reid Horrigan. All rights reserved. No copying, redistribution, modification or reverse engineering; no text and data mining; no use to train or develop AI or machine-learning models. Terms: LICENSE.html at this site's page. */
import{zipOf as u,filesOf as a}from"./zip.js";import{parseXML as m}from"../notation/musicxml-read.js";const p="application/vnd.recordare.musicxml",x="application/vnd.recordare.musicxml+xml",c="META-INF/container.xml";function w(o,e="score.musicxml"){const t=`<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="${e}" media-type="${x}"/>
  </rootfiles>
</container>
`;return u([["mimetype",p],[c,t,{deflate:!0}],[e,o,{deflate:!0}]])}function f(o){const e=o[0]===255&&o[1]===254?"utf-16le":o[0]===254&&o[1]===255?"utf-16be":"utf-8";return new TextDecoder(e).decode(o)}function d(o){const e=new Map(a(o).map(({name:i,bytes:r})=>[i,r])),t=e.get(c);if(!t)throw new Error(`Not a compressed MusicXML: no ${c}`);const l=i=>{for(const r of i.children??[]){if(r.name==="rootfile")return r;const s=l(r);if(s)return s}return null},n=l(m(f(t)))?.attributes["full-path"];if(!n||!e.has(n))throw new Error(`A compressed MusicXML whose container names ${n?`${n}, which it does not hold`:"no score"}`);return f(e.get(n))}const L=o=>o[0]===80&&o[1]===75?d(o):f(o);export{x as MUSICXML_TYPE,p as MXL_TYPE,L as musicXMLOf,d as musicXMLOfMxl,w as mxlOf};
