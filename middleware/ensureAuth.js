//Models
const { User } = require('../models/user');

let ensureAuth = (req, res, next) => {
    let token = req.cookies.w_auth;

    User.findByToken(token, (err, user) => {
        if (err) throw err;
        if(!user){
            res.redirect('/admin-login');
            return;
        }

        req.token = token;
        req.user = user;
        next();
    })
}

module.exports = { ensureAuth };