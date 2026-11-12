import { Worker } from "node:worker_threads";
export type OfficeText = { text: string; warnings: string[] };
// The worker only reads selected XML parts in memory; it never extracts paths,
// resolves relationships, runs formulas/macros, or fetches external resources.
const officeWorker = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { unzipSync } = require('fflate');
const { SaxesParser } = require('saxes');
try {
  let entries = 0, expanded = 0, text = '', warnings = [];
  const bytes = new Uint8Array(workerData.bytes);
  if (bytes.length > 5 * 1024 * 1024) throw Error('size');
  const files = unzipSync(bytes, { filter(file) {
    if (++entries > 1000) throw Error('entries');
    if (/\.\.|^\//.test(file.name)) throw Error('path');
    if (!/^(word\/document\.xml|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(file.name)) return false;
    expanded += file.originalSize;
    if (file.originalSize > 8 * 1024 * 1024 || expanded > 16 * 1024 * 1024) throw Error('expanded size');
    return true;
  }});
  const append = value => { text += value; if (text.length > 25000) { text = text.slice(0,25000); throw Error('text limit'); } };
  const parse = (bytes, handlers) => {
    const xml = new TextDecoder('utf-8', { fatal:true }).decode(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('entities');
    const parser = new SaxesParser({ xmlns:true });
    let depth = 0;
    parser.on('opentag', tag => { if (++depth > 64) throw Error('depth'); handlers.open?.(tag); });
    parser.on('closetag', tag => { handlers.close?.(tag); depth--; });
    parser.on('text', value => handlers.text?.(value));
    parser.on('cdata', value => handlers.text?.(value));
    parser.write(xml).close();
  };
  if (workerData.kind === 'docx') {
    if (!files['word/document.xml']) throw Error('missing document');
    let inText = false;
    parse(files['word/document.xml'], {
      open(tag) { if (tag.local === 't') inText = true; if (tag.local === 'tab') append('\t'); },
      text(value) { if (inText) append(value); },
      close(tag) { if (tag.local === 't') inText = false; if (['p','tr','tc','br'].includes(tag.local)) append('\n'); }
    });
    warnings.push('DOCX extraction covers the main document only; headers, footnotes, images and embedded files require review.');
  } else {
    const strings = [];
    let inText = false, current = '';
    if (files['xl/sharedStrings.xml']) parse(files['xl/sharedStrings.xml'], {
      open(tag) { if(tag.local==='si') current=''; if(tag.local==='t') inText=true; },
      text(value) { if(inText) current += value; },
      close(tag) { if(tag.local==='t') inText=false; if(tag.local==='si') { if(strings.length>=10000 || current.length>10000) throw Error('strings limit'); strings.push(current); } }
    });
    const sheets = Object.keys(files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
    if (!sheets.length) throw Error('missing sheets');
    if (sheets.length > 10) warnings.push('Only ten worksheets were extracted.');
    let cells = 0;
    for (const name of sheets.slice(0,10)) {
      append('\nWorksheet ' + name.split('/').pop() + '\n');
      let type='', cell='', value='', inValue=false, formula=false;
      parse(files[name], {
        open(tag) {
          if(tag.local==='c') { type=tag.attributes.t?.value||''; cell=tag.attributes.r?.value||'?'; value=''; formula=false; if(++cells>5000) throw Error('cell limit'); }
          if(tag.local==='v'||tag.local==='t') inValue=true;
          if(tag.local==='f') formula=true;
        },
        text(chunk) { if(inValue) value+=chunk; },
        close(tag) {
          if(tag.local==='v'||tag.local==='t') inValue=false;
          if(tag.local==='c') {
            const result=type==='s' ? strings[Number(value)] : value;
            if(formula) { append(cell+': [formula omitted; cached result is unverified]\n'); }
            else if(result) append(cell+': '+result+'\n');
          }
        }
      });
    }
    warnings.push('Spreadsheet formulas are not executed; formatting, dates, hidden content and external references need review.');
  }
  parentPort.postMessage({text,warnings});
} catch(error) {
  if (error.message === 'text limit' || error.message === 'cell limit') {
    // Do not return a partial parser state as a complete source.
    parentPort.postMessage({text:'',warnings:['Office document exceeds extraction limits; manual review required.']});
  } else parentPort.postMessage({text:'',warnings:['Office document could not be safely extracted; manual review required.']});
}
`;
export function officeText(bytes: Uint8Array, kind: "docx" | "xlsx"): Promise<OfficeText> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(officeWorker, { eval: true, workerData: { bytes, kind }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Office extraction deadline exceeded")); }, 20000);
    worker.once("message", (value: OfficeText) => { clearTimeout(timer); void worker.terminate(); resolve(value); });
    worker.once("error", () => { clearTimeout(timer); reject(new Error("Office extraction failed")); });
    worker.once("exit", code => { clearTimeout(timer); if (code !== 0) reject(new Error("Office extraction failed")); });
  });
}
