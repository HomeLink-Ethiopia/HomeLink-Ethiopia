const User = require("../models/User");
const Account = require("../models/Account");

const migrateUserToAccount = async (req ,res) =>{
    const user = await User.findById(userId);
    if(!user) return null;

    let account = await Account.findOne({ email: user.email });
    if (account) return account;

    account = await Account.create({
        email:user.email,
        phone: user.phone,
        passwordHash: user.password,
        roles:[user.role],
        preferredLanguage:'en',
        isActive: user.isActive,
        emailVerified:user.emailVerified,
        emailVerificationCode: user.emailVerificationCode,
        emailVerificationExpires:user.emailVerificationExpires,
        passwordResetCode:user.passwordResetCode,
        passwordResetExpires:user.passwordResetExpires
    });

    return account;
};

module.exports = { migrateUserToAccount };

