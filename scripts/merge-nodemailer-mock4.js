// merge-nodemailer-mock4.js — FORMAL verification everywhere: mock-mode
// branches stop returning the code when email delivered successfully.
// The code appears in responses ONLY when SMTP delivery failed (rescue).
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
  `devVerificationCode: verificationCode, // mock mode: dev/demo code stays visible`,
  `...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // formal verification: code by email only`,
  "mock register+resend → formal (email-only on success)",
  2
);

// forgot mock branch
rep(
  `devResetCode: resetCode, // mock mode: dev/demo code stays visible`,
  `...(emailResult.delivered ? {} : { devResetCode: resetCode }), // formal verification: code by email only`,
  "mock forgot → formal (email-only on success)",
  1
);

if (fails > 0) process.exit(1);
fs.writeFileSync(file, src);
console.log("DONE");
