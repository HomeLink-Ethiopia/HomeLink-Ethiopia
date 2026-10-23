// merge-nodemailer-mock.js — mock-mode branches also send via nodemailer;
// dev rescue (code in response) only when delivery fails.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "backend", "src", "controller", "authContoller.js");
let src = fs.readFileSync(file, "utf8");
let fails = 0;

function rep(oldStr, newStr, label) {
  const oCRLF = oldStr.replace(/\n/g, "\r\n");
  const nCRLF = newStr.replace(/\n/g, "\r\n");
  let c = src.split(oCRLF).length - 1;
  if (c > 0) {
    src = src.split(oCRLF).join(nCRLF);
  } else {
    c = src.split(oldStr).length - 1;
    if (c === 0) {
      console.error("MISS: " + label);
      fails++;
      return;
    }
    src = src.split(oldStr).join(newStr);
  }
  console.log(`OK (${c}): ` + label);
}

// 1) register mock branch: email the code; rescue only if delivery failed
rep(
  `      console.log(\`\u26a1 [MOCK DB] User registered: \${email} (\${assignedRole}) | Verification Code: \${verificationCode}\`);
      persistMockUsers(); // sprint-persist-mock-users

      return res.status(201).json({
        message: "User registered successfully",
        verificationCode: verificationCode,`,
  `      const emailResult = await sendVerificationEmail(email, verificationCode);
      console.log(\`\u26a1 [MOCK DB] User registered: \${email} (\${assignedRole}) | email delivered: \${emailResult.delivered} | Verification Code: \${verificationCode}\`);
      persistMockUsers(); // sprint-persist-mock-users

      return res.status(201).json({
        message: "User registered successfully",
        ...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // nodemailer merge: rescue only when SMTP unavailable
        emailSent: emailResult.delivered,`,
  "register mock branch"
);

// 2) resend mock branch: email the code; rescue only if delivery failed
rep(
  `      console.log("\u26a1 [MOCK DB] New verification code for " + email + ": " + verificationCode);
      persistMockUsers(); // sprint-persist-mock-users
      return res.status(200).json({ message: "Verification code sent", devVerificationCode: verificationCode });`,
  `      const emailResult = await sendVerificationEmail(email, verificationCode);
      console.log("\u26a1 [MOCK DB] New verification code for " + email + ": " + verificationCode + " | email delivered: " + emailResult.delivered);
      persistMockUsers(); // sprint-persist-mock-users
      return res.status(200).json({
        message: "Verification code sent",
        ...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // nodemailer merge: rescue only when SMTP unavailable
        emailSent: emailResult.delivered,
      });`,
  "resend mock branch"
);

// 3) forgot mock branch: email the code; rescue only if delivery failed
rep(
  `      console.log(\`\u26a1 [MOCK DB] Password reset code for \${email}: \${resetCode}\`);
      persistMockUsers(); // sprint-persist-mock-users
      return res.status(200).json({ message: "Password reset code sent to your email", devResetCode: resetCode });`,
  `      const emailResult = await sendVerificationEmail(email, resetCode);
      console.log(\`\u26a1 [MOCK DB] Password reset code for \${email}: \${resetCode} | email delivered: \${emailResult.delivered}\`);
      persistMockUsers(); // sprint-persist-mock-users
      return res.status(200).json({
        message: "Password reset code sent to your email",
        ...(emailResult.delivered ? {} : { devResetCode: resetCode }), // nodemailer merge: rescue only when SMTP unavailable
        emailSent: emailResult.delivered,
      });`,
  "forgot mock branch"
);

if (fails > 0) process.exit(1);
fs.writeFileSync(file, src);
console.log("DONE");
