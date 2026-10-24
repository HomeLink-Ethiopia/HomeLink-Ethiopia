require("dotenv").config();

const { sendVerificationEmail } = require("./src/utils/emailService");

// Test email utility script - disabled by default to avoid disturbing team inboxes
const testEmail = async () => {
    const targetEmail = process.env.TEST_EMAIL_RECIPIENT;
    if (!targetEmail) {
        console.log("ℹ️  testEmail skipped: set TEST_EMAIL_RECIPIENT in .env to test specific delivery.");
        return;
    }
    const result = await sendVerificationEmail(targetEmail, "123456");
    console.log("Email result:", result);
};

testEmail();