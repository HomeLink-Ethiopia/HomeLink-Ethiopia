const mongoose = require('mongoose');

const tenantPreferenceSchema = new mongoose.Schema({
    tenantId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Account',
        required: true,
        unique: true
    },

    budget:{
        min: {type: Number , default:0},
        max: {type: Number , default:10000}
    },

    location:{
        city: {type: String},
        subCity: {type: String},
        coordinated:{
            type: {type: String, enum:['Point'], default: 'Point'},
            coordinates: {type: [Number], default: [0, 0]},
        }
    },

    propertyType:{
        type: String,
        enum: ['apartment','house' , 'room', 'studio', 'villa', 'condominium' , 'commercial' ]
    },

    bedrooms:{
        type: Number,
        min:0
    },

    bathrooms:{
        type: Number,
        min:0
    },

    furnished:{
        type: Boolean,
    },

    amenities: [{type: String}],

    moveInDate:{
        type: Date
    },

    createdAt: {type: Date, default: Date.now},
    updatedAt: {type: Date, default: Date.now}
});

tenantPreferenceSchema.index({ tenantId:1});

module.exports = mongoose.model('TenantPreference', tenantPreferenceSchema);