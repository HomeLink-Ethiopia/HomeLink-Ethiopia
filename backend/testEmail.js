require("dotenv").config();

const { sendVerificationEmail } = require("./src/utils/emailService");

const testEmail = async () =>{
    const result = await sendVerificationEmail(
        "kidstekinfe21@gmail.com",
        "123456"
    );

    console.log("Email result:", result);
};

testEmail();