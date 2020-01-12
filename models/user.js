const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SALT_I = 10;
const crypto = require('crypto');
//const moment = require('moment');

require('dotenv').config();

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
    latitudeandlongitudedrop: {
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
    tripdistance: {
        type: String
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
        type: String,
        default: "28.063920"
    },
    driverlon: {
        type: String,
        default: "81.619580"
    },

    //token
    token: {
        type: String
    },
    resetToken: {
        type: String
    },
    resetTokenExp: {
        type: Number
    }

})

userSchema.index({ geolocation: '2dsphere' });

userSchema.pre('save', function (next) {
    var user = this;

    if (user.isModified('password')) {
        bcrypt.genSalt(SALT_I, function (err, salt) {
            if (err) return next(err);

            bcrypt.hash(user.password, salt, function (err, hash) {
                if (err) return next(err);

                user.password = hash;
                next();
            })
        })
    } else {
        next();
    }
})

userSchema.methods.comparePassword = function (candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    })
}

userSchema.methods.generateToken = function (cb) {
    var user = this;
    var token = jwt.sign(user._id.toHexString(), process.env.SECRET);

    user.token = token;
    user.save(function (err, user) {
        if (err) return cb(err);
        cb(null, user);
    })
}

userSchema.statics.findByToken = function (token, cb) {
    var user = this;

    jwt.verify(token, process.env.SECRET, function (err, decode) {
        user.findOne({ "_id": decode, "token": token }, function (err, user) {
            if (err) return cb(err);
            cb(null, user);
        })
    })
}

const User = mongoose.model('User', userSchema);

module.exports = { User };