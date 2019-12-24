const express = require('express');
const compression = require('compression');
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { ensureAuthenticated } = require('./helpers/auth');

const app = express();
app.use(compression());

//database config
const db = require('./config/database');
//passport config
require('./config/passport')(passport);

// Mongoose
mongoose.Promise = global.Promise;
mongoose.connect(db.mongoURI, {
    useUnifiedTopology: true,
    useNewUrlParser: true
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

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// method override middleware
app.use(methodOverride('_method'));

// express session middleware
app.use(session({ secret: 'secret', resave: true, saveUninitialized: true }))

//passport middleware
app.use(passport.initialize());
app.use(passport.session());

// flash middleware
app.use(flash());

// Global variables
app.use(function (req, res, next) {
    res.locals.success_msg = req.flash("success_msg");
    res.locals.error_msg = req.flash("error_msg");
    res.locals.error = req.flash("error");
    res.locals.user = req.user || null;
    next();
})


//Models
const { User } = require('./models/user');
const { Blog } = require('./models/blog');

//====================================Routes================================================

app.get("/", (req, res) => {
    res.render('index/index');
})

app.get('/ride-search', (req, res) => {
    let pickupLat = req.query['lat-pickup'];
    let pickupLon = req.query['lon-pickup'];

    if (req.user) {
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
                        // "city": { "$regex": req.query['city'], "$options": "i" },
                        // "location": { "$regex": req.query['location'], "$options": "i" },
                        // "purpose": { "$regex": req.query['purpose'], "$options": "i" },
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
    } else {
        req.flash('error_msg', 'Please login, before you continue booking ride');
        res.redirect('/admin-login')
    }
})

app.put('/ride-confirm/:_id', (req, res) => {
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
    if (!req.user) {
        res.render('admin/login');
    } else {
        return res.redirect('/');
    }
})

app.post("/admin-login", (req, res, next) => {
    passport.authenticate("local", {
        successRedirect: '/',
        failureRedirect: "/admin-login",
        failureFlash: true
    })(req, res, next)
})

app.get("/admin-register", (req, res) => {
    res.render('admin/register');
})

app.get("/admin-driver-register", (req, res) => {
    res.render('admin/registerdriver');
})

app.post('/admin-register', (req, res) => {
    let errors = []

    if (req.body.password != req.body.password2) {
        errors.push({ text: "Password did not match" });
    }

    if (errors.length > 0) {
        res.render('admin/register', {
            errors: errors,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            email: req.body.email,
            password: req.body.password,
            password2: req.body.password2
        })
    } else {
        User.findOne({ email: req.body.email })
            .then(user => {
                if (user) {
                    req.flash("error_msg", "The email is already registered with Nepsride")
                    res.redirect("/admin-login")
                } else {
                    let newUser = {
                        firstname: req.body.firstname,
                        lastname: req.body.lastname,
                        email: req.body.email,
                        password: req.body.password,
                        password2: req.body.password2
                    }
                    bcrypt.genSalt(10, function (err, salt) {
                        bcrypt.hash(newUser.password, salt, function (err, hash) {
                            if (err) throw err;
                            newUser.password = hash;
                            new User(newUser)
                                .save()
                                .then(user => {
                                    req.flash("success_msg", "You are now registered, please sign in !")
                                    res.redirect("/admin-login")
                                })
                                .catch(err => console.log(err))
                        })
                    })
                }
            })
            .catch(err => console.log(err))
    }
})

app.post('/admin-driver-register', (req, res) => {
    let errors = []

    if (req.body.password != req.body.password2) {
        errors.push({ text: "Password did not match" });
    }

    if (errors.length > 0) {
        res.render('admin/register', {
            errors: errors,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            email: req.body.email,
            password: req.body.password,
            password2: req.body.password2,
            drivernumber: req.body.drivernumber,
            driverimage: req.body.driverimage,
            vehiclename: req.body.vehiclename,
            vehiclenumber: req.body.vehiclenumber,
            vehicleimage: req.body.vehicleimage
        })
    } else {
        User.findOne({ email: req.body.email })
            .then(user => {
                if (user) {
                    req.flash("error_msg", "The email is already registered with Nepsride")
                    res.redirect("/admin-login")
                } else {
                    let newUser = {
                        firstname: req.body.firstname,
                        lastname: req.body.lastname,
                        email: req.body.email,
                        password: req.body.password,
                        password2: req.body.password2,
                        drivernumber: req.body.drivernumber,
                        driverimage: req.body.driverimage,
                        vehiclename: req.body.vehiclename,
                        vehiclenumber: req.body.vehiclenumber,
                        vehicleimage: req.body.vehicleimage,
                        vehicletype: req.body.vehicletype,
                        city: req.body.city,
                        location: req.body.location,
                        purpose: req.body.purpose,
                        available: req.body.available
                    }
                    bcrypt.genSalt(10, function (err, salt) {
                        bcrypt.hash(newUser.password, salt, function (err, hash) {
                            if (err) throw err;
                            newUser.password = hash;
                            new User(newUser)
                                .save()
                                .then(user => {
                                    req.flash("success_msg", "You are now registered, please sign in !")
                                    res.redirect("/admin-login")
                                })
                                .catch(err => console.log(err))
                        })
                    })
                }
            })
            .catch(err => console.log(err))
    }
})

app.get('/admin-logout', (req, res) => {
    req.logout();
    req.flash("success_msg", "You are logged out of your id, successfully");
    res.redirect("/admin-login");
})

app.get('/admin/upcoming-ride', ensureAuthenticated, (req, res) => {
    res.render('admin/upcomingride');
})

app.put('/admin/changestatus/:_id', (req, res) => {
    User.findOne({
        _id: req.params._id
    })
        .then(user => {
            user.available = req.body.available;
            user.city = req.body.city;
            user.purpose = req.body.purpose;
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

app.get('/admin/myaccount', ensureAuthenticated, (req, res) => {
    let lon = req.user.geolocation.coordinates[0];
    let lat = req.user.geolocation.coordinates[1];

    res.render('admin/myaccount', { lon: lon, lat: lat });
})

// Cancel ride for customer
app.put('/cancel-ride-customer/:_id', (req, res) => {
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
app.put('/cancel-ride-driver/:_id', (req, res) => {
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

                    user.save()
                }).catch(err => console.log(err))
        ]
    ).then(function (values) {
        req.flash('success_msg', 'Ride has been Cancelled, please update you geolocation & availability');
        res.redirect('/your-rides');

        console.log(values)
    }).catch(err => console.log(err))
})

app.put('/ride-start/:_id', (req, res) => {
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

app.get('/your-rides', ensureAuthenticated, (req, res) => {
    User.findOne({
        _id: req.user._id
    })
        .then(user => {
            res.render("admin/your-rides", { user: user })
        })
        .catch(err => console.log(err))
})

// End the ride / complete ride
app.put('/ride-end/:_id', (req, res) => {
    let customerhistory = [];
    let driverhistory = [];

    customerhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'completed',
        adress: req.user.adress,
        destination: req.user.destination,
        driverimage: req.user.driverimage
    })

    driverhistory.push({
        vehicletype: req.user.vehicletype,
        date: Date.now(),
        ridestatus: 'completed',
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
                    user.ridecompleted = user.ridecompleted + 1;

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

    User.find({'admin': 'true'}).skip((perPage * page) - perPage).limit(perPage).sort('-ridecompleted')
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

// 404 Page
app.get('*', function (req, res) {
    res.render('index/404');
});

const PORT = (process.env.PORT || 8000);

app.listen(PORT, () => {
    console.log("App is running on port " + PORT)
})