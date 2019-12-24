const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    admin: {
        type: String,
        default: 'false'
    },
    history: {
        type: Array,
        default: []
    },
    date: {
        type: Date,
        default: Date.now
    },

    // driver details
    ridecompleted: {
        type: Number,
        default: 0
    },
    drivernumber: {
        type: String
    },
    driverimage: {
        type: String
    },
    vehicletype: {
        type: String
    },
    vehiclename: {
        type: String
    },
    vehiclenumber: {
        type: String
    },
    vehicleimage: {
        type: String
    },
    available: {
        type: String
    },
    driverid: {
        type: mongoose.Schema.Types.ObjectId
    },

    //customer details
    ridestatus: {
        type: String,
        default: 'false'
    },
    latitudeandlongitude: {
        type: String
    },
    adress: {
        type: String
    },
    contactinfo: {
        type: String
    },
    destination: {
        type: String
    },
    latitudeandlongitudedrop:{
        type: String
    },
    customerid: {
        type: mongoose.Schema.Types.ObjectId
    },

    // match details
    matchfirstname: {
        type: String
    },
    matchlastname: {
        type: String
    },
    bookingdate: {
        type: Date
    },


    //geolocation detail
    geolocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [81.6263254, 28.0668895]
        }
    },
    driverlat: {
        type: String
    },
    driverlon: {
        type: String
    }

})

userSchema.index({ geolocation: '2dsphere' });

const User = mongoose.model('User', userSchema);

module.exports = { User };