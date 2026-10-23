// merge-nodemailer-mock3.js (v2) — mock-mode branches ALWAYS return the dev
// code (demo convenience; fake dev emails can't receive mail), real-DB
// branches stay formal. register+resend share identical text (count 2).
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "backend", "src", "controller", "authContoller.js");
let src = fs.readFileSync(file, "utf8");
let fails = 0;

function rep(oldStr, newStr, label, expect = 1) {
  const oCRLF = oldStr.replace(/\n/g, "\r\n");
  const nCRLF = newStr.replace(/\n/g, "\r\n");
  let c = src.split(oCRLF).length - 1;
  if (c > 0) {
    src = src.split(oCRLF).join(nCRLF);
  } else {
    c = src.split(oldStr).length - 1;
    if (c !== expect) {
      console.error("MISS/COUNT(" + c + "): " + label);
      fails++;
      return;
    }
    src = src.split(oldStr).join(newStr);
  }
  console.log(`OK (${c}): ` + label);
}

// register + resend mock branches (identical text → expect 2)
rep(
  `...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // nodemailer merge: rescue only when SMTP unavailable`,
  `devVerificationCode: verificationCode, // mock mode: dev/demo code stays visible`,
  "mock register+resend → always-on code",
  2
);

// forgot mock branch
rep(
  `...(emailResult.delivered ? {} : { devResetCode: resetCode }), // nodemailer merge: rescue only when SMTP unavailable`,
  `devResetCode: resetCode, // mock mode: dev/demo code stays visible`,
  "mock forgot → always-on code",
  1
);

if (fails > 0) process.exit(1);
fs.writeFileSync(file, src);
console.log("DONE");
