// Runs in the artifact directory after production-only dependency installation.
// Synthetic documents only; never opens credentials or makes provider requests.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { pdfText } from "../lib/automation/pdf-text";
import { officeText } from "../lib/automation/office-text";
import { zipSync, strToU8 } from "fflate";

function samplePdf() {
  const content =
    "BT /F1 12 Tf 50 750 Td (AssentPay offline extraction probe) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf));
}

// Eval workers resolve packages from cwd: use the isolated artifact installation,
// never the development repository's node_modules.
process.chdir(fileURLToPath(new URL(".", import.meta.url)));
let stage = "native-pdf";
try {
  // Direct native import fails loudly if npm omitted the target-platform optional
  // binary. The extraction probe also exercises PDF.js and its packaged worker.
  const { PDFParse } = await import("pdf-parse");
  assert.equal(typeof PDFParse, "function");
  stage = "bounded-pdf-worker";
  const pdf = await pdfText(samplePdf());
  assert.match(pdf.text, /AssentPay offline extraction probe/);
  assert.equal(pdf.total, 1);
  stage = "docx-worker";
  const docx = zipSync({
    "word/document.xml": strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Offline office probe</w:t></w:r></w:p></w:body></w:document>',
    ),
  });
  assert.match((await officeText(docx, "docx")).text, /Offline office probe/);
  stage = "xlsx-worker";
  const xlsx = zipSync({
    "xl/worksheets/sheet1.xml": strToU8(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>Offline sheet probe</t></is></c></row></sheetData></worksheet>',
    ),
  });
  assert.match((await officeText(xlsx, "xlsx")).text, /Offline sheet probe/);
  // Import the actual adjacent artifact, not a second source bundle. A request
  // with no execution key must exit before credential or database access.
  stage = "artifact-private-ingress";
  const { default: handler } = await import(
    new URL("./index.js", import.meta.url).href
  );
  const denied = await handler({
    req: { headers: {}, method: "POST", bodyJson: {} },
    res: { json: (_body: unknown, status: number) => status },
  });
  assert.equal(denied, 403);
  console.log(
    JSON.stringify({
      event: "runtime.offline_verified",
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      checks: [
        "native-pdf",
        "bounded-pdf-worker",
        "docx-worker",
        "xlsx-worker",
        "artifact-private-ingress",
      ],
    }),
  );
} catch {
  // Never print document bytes, environment values or a loaded artifact's errors.
  console.error(
    JSON.stringify({
      event: "runtime.offline_verification_failed",
      stage,
      guidance:
        "Check Node22, target-platform optional native dependencies and worker extraction support.",
    }),
  );
  process.exitCode = 1;
}
