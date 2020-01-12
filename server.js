const express = require('express');
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');

const app = express();
require('dotenv').config();

// Mongoose Warning --- remove later
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
// Mongoose
mongoose.Promise = global.Promise;
mongoose.connect(process.env.DATABASE, {
    useUnifiedTopology: true
})
    .then(() => console.log('mongodb connected'))
    .catch(err => console.log(err));

// Handlebars Helpers
const {
    formatDate,
    paginate,
    truncate
} = require('./helpers/hbs');
// Handlebars middleware
app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    helpers: {
        xif: function (v1, operator, v2, options) {
            switch (operator) {
                case '==':
                    return (v1 == v2) ? options.fn(this) : options.inverse(this);
                case '===':
                    return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!==':
                    return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '!=':
                    return (v1 != v2) ? options.fn(this) : options.inverse(this);
                case '<':
                    return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=':
                    return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>':
                    return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=':
                    return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                case '&&':
                    return (v1 && v2) ? options.fn(this) : options.inverse(this);
                case '||':
                    return (v1 || v2) ? options.fn(this) : options.inverse(this);
                default:
                    return options.inverse(this);
            }
        },
        formatDate: formatDate,
        paginate: paginate,
        truncate: truncate
    }
}))
app.set('view engine', 'handlebars');

// static path
app.use(express.static(path.join(__dirname, 'public')));

//body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//cookie parser
app.use(cookieParser());

// method override middleware
app.use(methodOverride('_method'));

// express session middleware
app.use(session({ secret: 'secret', resave: true, saveUninitialized: true }))

// flash middleware
app.use(flash());

// Global variables
app.use(function (req, res, next) {
    res.locals.success_msg = req.flash("success_msg");
    res.locals.error_msg = req.flash("error_msg");
    next();
})


//Models
const { User } = require('./models/user');
const { Blog } = require('./models/blog');

//Middlewares
const { auth } = require('./helpers/auth');
const { ensureAuth } = require('./helpers/ensureAuth');

//====================================Api Routes============================================
app.post('/api/users/register', (req, res) => {
    User.findOne({ 'email': req.body.email })
        .then(user => {
            if (user) {
                return res.json({ registerSuccess: false, message: 'Email already registered' })
            } else {
                const newUser = new User(req.body);

                newUser.save((err, doc) => {
                    if (err) return res.json({ registerSuccess: false, err });

                    //sendEmail(doc.email, doc.name, null, "welcome");
                    return res.status(200).json({
                        registerSuccess: true
                    })
                })
            }
        })
})

app.post('/api/users/login', (req, res) => {
    User.findOne({ 'email': req.body.email }, (err, user) => {
        if (!user) return res.json({ loginSuccess: false, message: 'Auth failed, email not found' });

        user.comparePassword(req.body.password, (err, isMatch) => {
            if (!isMatch) return res.json({ loginSuccess: false, message: 'Wrong Password' });

            user.generateToken((err, user) => {
                if (err) return res.status(400).send(err);

                res.cookie('w_auth', user.token).status(200).json({
                    loginSuccess: true
                })
            })
        })
    })
})

app.get('/api/users/auth', auth, (req, res) => {
    res.status(200).json({
        isAdmin: req.user.admin,
        isAuth: true,

        _id: req.user._id,
        driverimage: req.user.driverimage,
        email: req.user.email,
        firstname: req.user.firstname,
        lastname: req.user.lastname,
        ridecompleted: req.user.ridecompleted,
        ridestatus: req.user.ridestatus,

        vehicletype: req.user.vehicletype,
        vehiclename: req.user.vehiclename,
        vehiclenumber: req.user.vehiclenumber,
        available: req.user.available,
        driverlat: req.user.driverlat,
        driverlon: req.user.driverlon,
        drivernumber: req.user.drivernumber,
        driverid: req.user.driverid,

        matchlastname: req.user.matchlastname,
        matchfirstname: req.user.matchfirstname,
        adress: req.user.adress,
        destination: req.user.destination,
        latitudeandlongitude: req.user.latitudeandlongitude,
        latitudeandlongitudedrop: req.user.latitudeandlongitudedrop,
        contactinfo: req.user.contactinfo,
        customerid: req.user.customerid,
        tripdistance: req.user.tripdistance,
        history: req.user.history
    })
})

app.get('/api/users/logout', auth, (req, res) => {
    User.findOneAndUpdate(
        { _id: req.user._id },
        { token: '' },
        (err, doc) => {
            if (err) return res.json({ success: false, err });

            return res.status(200).send({
                success: true
            })
        }
    )
})

//====================================Fronted Routes================================================

app.get("/", (req, res) => {
    res.render('index/index');
})

app.get('/ride-search', ensureAuth, (req, res) => {
    let pickupLat = req.query['lat-pickup'];
    let pickupLon = req.query['lon-pickup'];

    if (req.user.admin == 'true') {
        req.flash('error_msg', 'Admin user cannot book rides, thankyou');
        res.redirect('/admin/myaccount')
    } else {
        if (req.user.ridestatus == 'pending' || req.user.ridestatus == 'true') {
            req.flash('error_msg', 'You hav an ongoing ride, please complete it first');
            res.redirect('/admin/upcoming-ride');
        } else {
            User.find(
                {
                    "vehicletype": { "$regex": req.query['vehicletype'], "$options": "i" },
                    "admin": "true",
                    "available": "yes",
                    "geolocation": {
                        $near: {
                            $geometry: {
                                type: "Point",
                                coordinates: [pickupLon, pickupLat]
                            },
                            $maxDistance: 16000
                        }
                    }
                }
            )
                // .sort('-ridecompleted')
                .limit(1)
                .then(users => {
                    res.render("index/search", { users: users })
                })
                .catch(err => console.log(err))
        }
    }
})

app.put('/ride-confirm/:_id', ensureAuth, (req, res) => {
    let userAvailable = true;

    Promise.all(
        [
            User.findOne({
                _id: req.params._id
            })
                .then(user => {
                    if (user.available == "no") {
                        userAvailable = false;
                        return;
                    }

                    user.customerid = req.user._id;
                    user.matchfirstname = req.user.firstname;
                    user.matchlastname = req.user.lastname;
                    user.available = "no";
                    user.latitudeandlongitude = req.body.latitudeandlongitude;
                    user.latitudeandlongitudedrop = req.body.latitudeandlongitudedrop;
                    user.adress = req.body.adress;
                    user.destination = req.body.destination;
                    user.contactinfo = req.body.contactinfo;
                    user.ridestatus = 'pending';
                    user.bookingdate = Date.now();
                    user.tripdistance = req.body.tripdistance;

                    user.save()
                }).catch(err => console.log(err))
            ,
            User.findOne({
                _id: req.user._id
            })
                .then(user => {
                    if (userAvailable == false) {
                        return;
                    }

                    user.driverid = req.body.driverid;
                    user.matchfirstname = req.body.firstname;
                    user.matchlastname = req.body.lastname;
                    user.ridestatus = 'pending';
                    user.drivernumber = req.body.drivernumber;
                    user.driverimage = req.body.driverimage;
                    user.vehicletype = req.body.vehicletype;
                    user.vehiclename = req.body.vehiclename;
                    user.vehiclenumber = req.body.vehiclenumber;
                    user.vehicleimage = req.body.vehicleimage;
                    user.destination = req.body.destination;
                    user.adress = req.body.adress;
                    user.bookingdate = Date.now();
                    user.tripdistance = req.body.tripdistance;

                    user.save()
                }).catch(err => console.log(err))
        ]
    ).then(function (values) {
        if (userAvailable) {
            req.flash('success_msg', 'Your ride has been succesfully Confirmed !');
            res.redirect('/admin/upcoming-ride');
        }
        if (!userAvailable) {
            req.flash('error_msg', 'Someone else booked him just before you, please confirm another one');
            res.redirect('back');
        }
        console.log(values)
    }).catch(err => console.log(err))

})

app.get("/about-us", (req, res) => {
    res.render('index/aboutus');
})

app.get("/admin-login", (req, res) => {
    res.render('admin/login');
})

app.get("/admin-register", (req, res) => {
    res.render('admin/register');
})

app.get("/admin-driver-register", (req, res) => {
    res.render('admin/registerdriver');
})

app.get('/admin/upcoming-ride', (req, res) => {
    res.render('admin/upcomingride');
})

app.put('/admin/changestatus/:_id', (req, res) => {
    User.findOne({
        _id: req.params._id
    })
        .then(user => {
            user.available = req.body.available;
            user.geolocation.coordinates = [req.body.lon, req.body.lat];
            user.driverlat = req.body.lat;
            user.driverlon = req.body.lon;

            user.save()
                .then(user => {
                    req.flash('success_msg', 'Your status has been changed & applied, thankyou');
                    res.redirect('/admin/myaccount');
                })
        }).catch(err => console.log(err));
})

app.put('/customer/changestatus/:_id', (req, res) => {
    User.findOne({
        _id: req.params._id
    })
        .then(user => {
            user.email = req.body.email;
            user.firstname = req.body.firstname;
            user.lastname = req.body.lastname;

            user.save()
                .then(user => {
                    req.flash('success_msg', 'Your info has been successfully changed, thankyou');
                    res.redirect('/admin/myaccount');
                })
        }).catch(err => console.log(err));
})

app.get('/admin/myaccount', (req, res) => {
    res.render('admin/myaccount');
})

// Cancel ride for customer
app.put('/cancel-ride-customer/:_id', ensureAuth, (req, res) => {
    let customerhistory = [];
    let driverhistory = [];

    customerhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'cancelled/c',
        adress: req.user.adress,
        destination: req.user.destination,
        driverimage: req.user.driverimage
    })

    driverhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'cancelled/c',
        adress: req.user.adress,
        destination: req.user.destination,
        driverimage: req.user.driverimage
    })


    if (req.user.ridestatus !== "true") {
        Promise.all(
            [
                User.findOne({
                    _id: req.params._id
                })
                    .then(user => {
                        let newhistory = user.history;

                        if (user.history.length >= 5) {
                            newhistory.splice(4, 1);
                        }

                        user.customerid = null;
                        user.matchfirstname = "";
                        user.matchlastname = "";
                        user.available = "yes";
                        user.latitudeandlongitude = "";
                        user.adress = "";
                        user.destination = "";
                        user.contactinfo = "";
                        user.ridestatus = 'false';
                        user.bookingdate = null;
                        user.history = [...driverhistory, ...newhistory];
                        user.tripdistance = "";

                        user.save()
                    }).catch(err => console.log(err))
                ,
                User.findOne({
                    _id: req.user._id
                })
                    .then(user => {
                        let newhistory = user.history;

                        if (user.history.length >= 5) {
                            newhistory.splice(4, 1);
                        }

                        user.driverid = null;
                        user.matchfirstname = "";
                        user.matchlastname = "";
                        user.ridestatus = 'false';
                        user.drivernumber = "";
                        user.driverimage = "";
                        user.vehicletype = "";
                        user.vehiclename = "";
                        user.vehiclenumber = "";
                        user.vehicleimage = "";
                        user.destination = "";
                        user.adress = "";
                        user.bookingdate = null;
                        user.history = [...customerhistory, ...newhistory];
                        user.tripdistance = "";

                        user.save()
                    }).catch(err => console.log(err))
            ]
        ).then(function (values) {
            req.flash('success_msg', 'Your ride has been successfully cancelled, contact us for support');
            res.redirect('/');

            console.log(values)
        }).catch(err => console.log(err))
    } else {
        req.flash('error_msg', 'Ride has already started, please contact driver to cancel the ride');
        res.redirect('/admin/upcoming-ride');
    }
})

// Cancel ride for Driver
app.put('/cancel-ride-driver/:_id', ensureAuth, (req, res) => {
    let customerhistory = [];
    let driverhistory = [];

    customerhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'cancelled/d',
        adress: req.user.adress,
        destination: req.user.destination,
        driverimage: req.user.driverimage
    })

    driverhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'cancelled/d',
        adress: req.user.adress,
        destination: req.user.destination,
        driverimage: req.user.driverimage
    })

    Promise.all(
        [
            User.findOne({
                _id: req.user._id
            })
                .then(user => {
                    let newhistory = user.history;

                    if (user.history.length >= 5) {
                        newhistory.splice(4, 1);
                    }

                    user.customerid = null;
                    user.matchfirstname = "";
                    user.matchlastname = "";
                    user.latitudeandlongitude = "";
                    user.adress = "";
                    user.destination = "";
                    user.contactinfo = "";
                    user.ridestatus = 'false';
                    user.bookingdate = null;
                    user.history = [...driverhistory, ...newhistory];
                    user.tripdistance = "";

                    user.save()
                }).catch(err => console.log(err))
            ,
            User.findOne({
                _id: req.params._id
            })
                .then(user => {
                    let newhistory = user.history;

                    if (user.history.length >= 5) {
                        newhistory.splice(4, 1);
                    }

                    user.driverid = null;
                    user.matchfirstname = "";
                    user.matchlastname = "";
                    user.ridestatus = 'false';
                    user.drivernumber = "";
                    user.driverimage = "";
                    user.vehicletype = "";
                    user.vehiclename = "";
                    user.vehiclenumber = "";
                    user.vehicleimage = "";
                    user.destination = "";
                    user.adress = "";
                    user.bookingdate = null;
                    user.history = [...customerhistory, ...newhistory];
                    user.tripdistance = "";

                    user.save()
                }).catch(err => console.log(err))
        ]
    ).then(function (values) {
        req.flash('success_msg', 'Ride has been Cancelled, please update you geolocation & availability');
        res.redirect('/your-rides');

        console.log(values)
    }).catch(err => console.log(err))
})

app.put('/ride-start/:_id', ensureAuth, (req, res) => {
    Promise.all(
        [
            User.findOne({
                _id: req.params._id
            })
                .then(user => {
                    user.ridestatus = 'true'

                    user.save()
                }).catch(err => console.log(err))
            ,
            User.findOne({
                _id: req.user._id
            })
                .then(user => {
                    user.ridestatus = 'true'

                    user.save()
                }).catch(err => console.log(err))
        ]
    ).then(function (values) {
        req.flash('success_msg', 'The ride has successfully started, Have a great day');
        res.redirect('/admin/upcoming-ride');

        console.log(values)
    }).catch(err => console.log(err))
})

app.get('/your-rides', (req, res) => {
    res.render("admin/your-rides")
})

// End the ride / complete ride
app.put('/ride-end/:_id', ensureAuth, (req, res) => {
    let customerhistory = [];
    let driverhistory = [];

    customerhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'completed',
        adress: req.user.adress,
        destination: req.user.destination,
        driverimage: req.user.driverimage,
        tripdistance: req.user.tripdistance
    })

    driverhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'completed',
        adress: req.user.adress,
        destination: req.user.destination,
        driverimage: req.user.driverimage,
        tripdistance: req.user.tripdistance
    })

    Promise.all(
        [
            User.findOne({
                _id: req.user._id
            })
                .then(user => {
                    let newhistory = user.history;

                    if (user.history.length >= 5) {
                        newhistory.splice(4, 1);
                    }

                    user.customerid = null;
                    user.matchfirstname = "";
                    user.matchlastname = "";
                    user.latitudeandlongitude = "";
                    user.adress = "";
                    user.destination = "";
                    user.contactinfo = "";
                    user.ridestatus = 'false';
                    user.bookingdate = null;
                    user.history = [...driverhistory, ...newhistory];
                    user.ridecompleted = user.ridecompleted + 1;
                    user.tripdistance = "";

                    user.save()
                }).catch(err => console.log(err))
            ,
            User.findOne({
                _id: req.params._id
            })
                .then(user => {
                    let newhistory = user.history;

                    if (user.history.length >= 5) {
                        newhistory.splice(4, 1);
                    }

                    user.driverid = null;
                    user.matchfirstname = "";
                    user.matchlastname = "";
                    user.ridestatus = 'false';
                    user.drivernumber = "";
                    user.driverimage = "";
                    user.vehicletype = "";
                    user.vehiclename = "";
                    user.vehiclenumber = "";
                    user.vehicleimage = "";
                    user.destination = "";
                    user.adress = "";
                    user.bookingdate = null;
                    user.history = [...customerhistory, ...newhistory];
                    user.ridecompleted = user.ridecompleted + 1;
                    user.tripdistance = "";

                    user.save()
                }).catch(err => console.log(err))
        ]
    ).then(function (values) {
        req.flash('success_msg', 'Ride has been Completed, please update you geolcoation & availability');
        res.redirect('/your-rides');

        console.log(values)
    }).catch(err => console.log(err))
})

//dashboard page
app.get('/dashboard', (req, res) => {
    const perPage = 9;
    const page = req.query.page || 1;

    User.find({ 'admin': 'true' }).skip((perPage * page) - perPage).limit(perPage).sort('-ridecompleted')
        .then(users => {
            User.countDocuments({ 'admin': 'true' }).then(drivercount => {
                User.countDocuments({ 'available': 'yes' }).then(availablecount => {
                    User.countDocuments({ 'available': 'no' }).then(notavailablecount => {
                        User.countDocuments({ 'admin': 'false' }).then(customercount => {
                            res.render('admin/dashboard', { users: users, availablecount: availablecount, notavailablecount: notavailablecount, customercount: customercount, current: parseInt(page), pages: Math.ceil(drivercount / perPage) });
                        }).catch(err => console.log(err));
                    }).catch(err => console.log(err));
                }).catch(err => console.log(err));
            }).catch(err => console.log(err));
        }).catch(err => console.log(err));
})

//Earn with us page
app.get('/earnwithus', (req, res) => {
    res.render('index/earnwithus');
})

//terms&conditions page
app.get('/termsandconditions', (req, res) => {
    res.render('index/termsandconditions');
})

//blogs page
app.get('/blogs', (req, res) => {
    const perPage = 3;
    const page = req.query.page || 1;

    Blog.find().skip((perPage * page) - perPage).limit(perPage).sort('-date')
        .then(blogs => {
            Blog.countDocuments().then(blogCount => {
                res.render('blog/blogs', { blogs: blogs, current: parseInt(page), pages: Math.ceil(blogCount / perPage) })
            }).catch(err => console.log(err));
        }).catch(err => console.log(err));
})

//blog detail page
app.get('/blog-detail/:slug', (req, res) => {
    Blog.findOne({
        slug: req.params.slug
    })
        .then(blog => {
            res.render('blog/blogdetail', { blog: blog });
        }).catch(err => console.log(err));
})

//blog edit page
app.get('/edit-blog/:_id', (req, res) => {
    Blog.findOne({
        _id: req.params._id
    })
        .then(blog => {
            res.render('blog/editblog', { blog: blog });
        }).catch(err => console.log(err));
})

app.put('/edit-blog/:_id', (req, res) => {
    Blog.findOne({
        _id: req.params._id
    })
        .then(blog => {
            blog.title = req.body.title,
                blog.body = req.body.body,
                blog.thumbnail = req.body.thumbnail,
                blog.author = req.body.author

            blog.save()
                .then(blog => {
                    req.flash('success_msg', 'The post has been successfully edited');
                    res.redirect('/blog-detail/' + blog.slug);
                })
        }).catch(err => console.log(err));
})

//delete blog
app.delete("/remove-blog/:_id", (req, res) => {
    Blog.deleteOne({
        _id: req.params._id
    }).then(() => {
        req.flash('success_msg', 'The post has been successfully deleted');
        res.redirect('/blogs');
    }).catch(err => console.log(err));
})

//add blog page
app.get('/addblog', (req, res) => {
    res.render('blog/addblog');
})

app.post('/addblog', (req, res) => {
    const newUser = {
        title: req.body.title,
        body: req.body.body,
        thumbnail: req.body.thumbnail,
        author: req.body.author
    }
    new Blog(newUser)
        .save()
        .then(blog => {
            req.flash('success_msg', 'The blog post is succsessfully added');
            res.redirect('/blogs');
        }).catch(err => console.log(err));
})

//offline page
app.get('/offline', (req, res) => {
    res.render('index/offline');
})

// 404 Page
app.get('*', function (req, res) {
    res.render('index/404');
});

const PORT = (process.env.PORT || 8000);

app.listen(PORT, () => {
    console.log("App is running on port " + PORT)
})