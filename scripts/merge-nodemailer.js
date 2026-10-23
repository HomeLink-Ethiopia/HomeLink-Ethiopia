// merge-nodemailer.js — port teammate's nodemailer into our auth controller
// Semantics: formal verification (code by email only). The response no longer
// carries the code when delivery succeeded; on-screen dev rescue appears only
// when delivery FAILED (delivered=false) or in mock mode (dev convenience).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const file = path.join(root, "backend", "src", "controller", "authContoller.js");
let src = fs.readFileSync(file, "utf8");
const hits = [];

// CRLF-tolerant replace: try \r\n first, fall back to \n
function rep(oldStr, newStr, expect, label) {
  const oCRLF = oldStr.replace(/\n/g, "\r\n");
  const nCRLF = newStr.replace(/\n/g, "\r\n");
  const count = (s) => src.split(s).length - 1;
  let c = count(oCRLF);
  if (c > 0) {
    src = src.split(oCRLF).join(nCRLF);
  } else {
    c = count(oldStr);
    if (c === 0) {
      console.error("MISS: " + label);
      process.exit(1);
    }
    src = src.split(oldStr).join(newStr);
  }
  hits.push(`${label}: replaced ${c} (expected ${expect})`);
  if (c !== expect) {
    console.error("COUNT-MISMATCH: " + label + " got " + c);
    process.exit(1);
  }
}

// A) register + resend: return devVerificationCode ONLY when delivery failed
rep(
  `      devVerificationCode: verificationCode,
      emailSent: emailResult.delivered,`,
  `      ...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // nodemailer merge: dev rescue only when email delivery failed
      emailSent: emailResult.delivered,`,
  2,
  "register+resend code fields"
);

// B) forgotPassword (real DB branch): same dev-rescue semantics
rep(
  `    res.status(200).json({
      message:"Password reset code sent to your email",
    });`,
  `    res.status(200).json({
      message:"Password reset code sent to your email",
      ...(emailResult.delivered ? {} : { devResetCode: resetCode }), // nodemailer merge: dev rescue only when email delivery failed
    });`,
  1,
  "forgotPassword rescue"
);

fs.writeFileSync(file, src);
console.log("PATCHED authContoller.js");
hits.forEach((h) => console.log("  " + h));

// ── .env: add Gmail SMTP creds from teammate's branch ──
const envFile = path.join(root, "backend", ".env");
let env = fs.readFileSync(envFile, "utf8");
if (!/EMAIL_HOST_USER/.test(env)) {
  if (!env.endsWith("\n")) env += "\n";
  env += "EMAIL_HOST_USER=kidstekinfe21@gmail.com\r\n";
  env += "EMAIL_HOST_PASSWORD=kfdx brul eyhx wmki\r\n";
  fs.writeFileSync(envFile, env);
  console.log("PATCHED backend/.env (added EMAIL_HOST_USER / EMAIL_HOST_PASSWORD)");
} else {
  console.log("SKIP .env: EMAIL_HOST_USER already present");
}

// ── package.json: add nodemailer dependency ──
const pkgFile = path.join(root, "backend", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
if (!pkg.dependencies.nodemailer) {
  pkg.dependencies.nodemailer = "^10.0.12";
  const keys = Object.keys(pkg.dependencies).sort();
  const sorted = {};
  keys.forEach((k) => (sorted[k] = pkg.dependencies[k]));
  pkg.dependencies = sorted;
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
  console.log("PATCHED backend/package.json (added nodemailer ^10.0.12)");
} else {
  console.log("SKIP package.json: nodemailer already present");
}

console.log("DONE");
