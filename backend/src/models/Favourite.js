const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
    tenantId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true
    },

    propertyId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

favouriteSchema.index({ tenantId: 1, propertyId: 1 }, { unique: true });

module.exports = mongoose.model('Favourite', favouriteSchema);