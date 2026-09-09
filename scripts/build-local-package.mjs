import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = join(root, 'dist', 'local-package');
const appDir = join(outputRoot, 'Diktat-Player');
const assetsDir = join(appDir, 'assets');
const tempDir = join(root, '.local-package-tmp');
const esbuild = process.env.ESBUILD_BIN || join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');

if (!existsSync(esbuild)) {
  throw new Error('Falta esbuild. Ejecuta "npm install" antes de crear el paquete.');
}

rmSync(outputRoot, { recursive: true, force: true });
rmSync(tempDir, { recursive: true, force: true });
mkdirSync(assetsDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

const encode = path => readFileSync(path).toString('base64');
const resourceScript = `(function(){
  const encoded={
    onnx:'${encode(join(root, 'assets', 'ort-wasm-simd-threaded.wasm'))}',
    data:'${encode(join(root, 'assets', 'piper_phonemize.data'))}',
    phonemizer:'${encode(join(root, 'assets', 'piper_phonemize.wasm'))}'
  };
  const urls={};
  const decode=(value,type)=>{const chunk=32768,parts=[];for(let at=0;at<value.length;at+=chunk){const raw=atob(value.slice(at,at+chunk)),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);parts.push(bytes)}return URL.createObjectURL(new Blob(parts,{type}))};
  window.DiktatLocalResources={getUrls(){urls.onnx||=decode(encoded.onnx,'application/wasm');urls.data||=decode(encoded.data,'application/octet-stream');urls.phonemizer||=decode(encoded.phonemizer,'application/wasm');return{onnxWasm:{wasm:urls.onnx},piperData:urls.data,piperWasm:urls.phonemizer}}};
})();\n`;
writeFileSync(join(assetsDir, 'local-resources.js'), resourceScript);

let piperEntry = readFileSync(join(root, 'assets', 'piper-tts-web-CfSr_hGN.js'), 'utf8');
piperEntry = piperEntry.replace('import{t as e}from"./index-CPQQ5Ah2.js";', 'const e=(loader)=>loader();');
piperEntry = piperEntry.replace('i.env.wasm.numThreads=navigator.hardwareConcurrency', 'i.env.wasm.numThreads=1');
piperEntry = piperEntry.replaceAll('import(`./piper-o91UDS6e-Bg8K-Nbs.js`)', 'import(`../assets/piper-o91UDS6e-Bg8K-Nbs.js`)');
piperEntry = piperEntry.replaceAll('import(`./ort.wasm.bundle.min-Bxag1mAh.js`)', 'import(`./ort-local.js`)');
piperEntry = piperEntry.replaceAll('import(`./voices_static-D_OtJDHM-fcs7f6Zg.js`)', 'import(`../assets/voices_static-D_OtJDHM-fcs7f6Zg.js`)');
const piperEntryPath = join(tempDir, 'piper-local-entry.js');
writeFileSync(piperEntryPath, piperEntry);
let ortEntry = readFileSync(join(root, 'assets', 'ort.wasm.bundle.min-Bxag1mAh.js'), 'utf8');
ortEntry = ortEntry.replace('from"./rolldown-runtime-DWdDZTNf.js"', 'from"../assets/rolldown-runtime-DWdDZTNf.js"');
ortEntry = ortEntry.replace('import{t}from"./index-CPQQ5Ah2.js";', 'const t=(loader)=>loader();');
writeFileSync(join(tempDir, 'ort-local.js'), ortEntry);
execFileSync(esbuild, [piperEntryPath, '--bundle', '--format=iife', '--global-name=PiperTts', '--platform=browser', '--target=es2020', '--minify', `--outfile=${join(assetsDir, 'piper-local.bundle.js')}`], { cwd: root, stdio: 'inherit' });

let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace('let installPrompt=null;', "const fileMode=location.protocol==='file:';let installPrompt=null;");
html = html.replace("if('serviceWorker' in navigator)window.addEventListener", "if(location.protocol!=='file:'&&'serviceWorker' in navigator)window.addEventListener");
html = html.replace(
  "const loadPiper=()=>piperTtsPromise||(piperTtsPromise=import('./assets/piper-tts-web-CfSr_hGN.js').catch(error=>{piperTtsPromise=null;throw error}));",
  "const loadClassicScript=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('No se pudo cargar '+src));document.head.appendChild(script)});const loadPiper=()=>piperTtsPromise||(piperTtsPromise=(fileMode?(async()=>{await loadClassicScript('./assets/local-resources.js');await loadClassicScript('./assets/piper-local.bundle.js');return window.PiperTts})():import('./assets/piper-tts-web-CfSr_hGN.js')).catch(error=>{piperTtsPromise=null;throw error}));"
);
html = html.replace(
  "const loadTransformers=()=>transformersJsPromise||(transformersJsPromise=import('./assets/whisper/transformers.web.min.js').catch(error=>{transformersJsPromise=null;throw error}));",
  "const loadTransformers=()=>fileMode?Promise.reject(Error('La transcripción todavía no está disponible en el paquete file://')):transformersJsPromise||(transformersJsPromise=import('./assets/whisper/transformers.web.min.js').catch(error=>{transformersJsPromise=null;throw error}));"
);
html = html.replace(
  "const refreshStorageInfo=async()=>{refreshStorage.disabled=true;try{const estimate=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():{},keys=await caches.keys()",
  "const refreshStorageInfo=async()=>{refreshStorage.disabled=true;try{const estimate=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():{},keys=typeof caches!=='undefined'?await caches.keys():[]"
);
const saveStart = html.indexOf(' const saveFile=async');
const filenameStart = html.indexOf(' const textFilename=', saveStart);
if (saveStart < 0 || filenameStart < 0) throw new Error('No se encontró la función de descarga');
const localAwareSave = " const saveFile=async(blob,name)=>{const safeName=String(name||'Dictado').replace(/[\\\\/:*?\"<>|]/g,'_');if(fileMode){const localUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=localUrl;link.download=safeName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(localUrl),120000);status.textContent='Descarga iniciada: '+safeName;return}const downloadUrl=new URL('./generated/'+encodeURIComponent(safeName),document.baseURI);downloadUrl.searchParams.set('v',Date.now().toString());status.textContent='Preparando descarga: '+safeName;const cache=await caches.open('diktat-generated-files'),request=new Request(downloadUrl.href);await cache.put(request,new Response(blob,{headers:{'Content-Type':blob.type||'application/octet-stream','Content-Disposition':\"attachment; filename*=UTF-8''\"+encodeURIComponent(safeName),'Cache-Control':'no-store'}}));location.assign(downloadUrl.href);status.textContent='Descarga iniciada: '+safeName;setTimeout(()=>cache.delete(request),120000)};\n";
html = html.slice(0, saveStart) + localAwareSave + html.slice(filenameStart);
html = html.replace("const keys=await caches.keys();await Promise.all(keys.map(key=>caches.delete(key)));", "const keys=typeof caches!=='undefined'?await caches.keys():[];await Promise.all(keys.map(key=>caches.delete(key)));");
html = html.replace("const setTranscriptionVisible=visible=>{", "const setTranscriptionVisible=visible=>{if(fileMode){status.textContent='La transcripción no está disponible todavía en el paquete local.';return}");
html = html.replace(
  "const tts=await window.piperTts;if(tts.TtsSession._instance",
  "const tts=await window.piperTts,localPaths=fileMode?window.DiktatLocalResources.getUrls():null;if(tts.TtsSession._instance"
);
html = html.replace(
  "wasmPaths:{onnxWasm:new URL('./assets/',document.baseURI).href,piperData:new URL('./assets/piper_phonemize.data',document.baseURI).href,piperWasm:new URL('./assets/piper_phonemize.wasm',document.baseURI).href}",
  "wasmPaths:localPaths||{onnxWasm:new URL('./assets/',document.baseURI).href,piperData:new URL('./assets/piper_phonemize.data',document.baseURI).href,piperWasm:new URL('./assets/piper_phonemize.wasm',document.baseURI).href}"
);
html = html.replace('Versión 30 · cambio limpio de voz y texto', 'Local 1 · paquete file://');
html = html.replace('Version 30 · sauberer Wechsel von Stimme und Text', 'Local 1 · file://-Paket');
html = html.replace("translateInterface();\n new MutationObserver", "translateInterface();\n if(fileMode){installButton.hidden=true;connectionStatus.textContent='Modo local';transcribeAudio.hidden=true;transcriptionNote.hidden=true;transcriptionActions.classList.add('dev-hidden')}\n new MutationObserver");
writeFileSync(join(appDir, 'index.html'), html);

for (const name of ['favicon.ico', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon.svg']) {
  copyFileSync(join(root, name), join(appDir, name));
}
writeFileSync(join(appDir, 'LEEME.txt'), `DIKTAT PLAYER — PAQUETE LOCAL 1\n\n1. Extrae completamente el ZIP.\n2. Abre la carpeta Diktat-Player.\n3. Abre index.html con Chrome, Edge o Firefox.\n4. La primera generación de cada voz necesita conexión a Internet para descargar el modelo de voz.\n\nDisponible en file://: texto, voz Dave/Thorsten, generación WAV, reproductor, carga y guardado TXT/WAV.\nNo disponible todavía en file://: instalación PWA, Service Worker, caché de recursos web y transcripción Whisper.\n`);

rmSync(tempDir, { recursive: true, force: true });
console.log(`Paquete creado en ${appDir}`);
