const { Resend } = require("resend");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const sendVerificationEmail = async (email, code) =>{
    try{
        if (!resend) {
            console.warn("⚠️ RESEND_API_KEY not set; email verification simulation for code:", code);
            return true;
        }
        const {data,error} = await resend.emails.send({
            from: "HomeLink <onboarding@resend.dev>",
            to: email,
            subject: "HomeLink Email Verification",
            html: `
                <h2>Welcome to HomeLink!</h2>
                <p>Your email verification code is:</p>
                <h1>${code}</h1>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not create HomeLink account, you can ignore this email.</p>
            `,
        });

        if(error) {
            console.error("Email sending error: ", error);
            return false;
        }

        console.log("Verification email sent:", data.id);

        return true;
    } catch(error){
        console.error("Email service error:" , error);
    }
};

module.exports={
    sendVerificationEmail,
};