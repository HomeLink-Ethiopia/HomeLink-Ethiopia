const Joi = require("joi");


const registerSchema = Joi.object({
    firstName:Joi.string()
        .trim()
        .min(2)
        .max(30)
        .required(),

    lastName:Joi.string()
        .trim()
        .min(2)
        .max(30)
        .required(),

    email: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required(),

    phone: Joi.string()
    .trim()
    .pattern(/^09[0-9]{8}$/)
    .required()
    .messages({
        "string.pattern.base": "Phone number must start with 09 and contain 10 digits",
    }),

    password: Joi.string()
        .min(8)
        .pattern(/[A-Z]/)
        .pattern(/[a-z]/)
        .pattern(/[0-9]/)
        .pattern(/[@$!%*?&]/)
        .required(),
});

module.exports ={
    registerSchema, 
}