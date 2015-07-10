// =============================================================================
// BASE SETUP {{{
// =============================================================================


var express        = require('express');
var passport       = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var app            = express();
var bodyParser     = require('body-parser');
var cookieParser   = require('cookie-parser');
var session        = require('express-session');
var flash          = require('connect-flash');
var debug          = require('debug')('api:clubs');
var moment         = require('moment');

var config         = require('./config.json');

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
	secret: config.sessionSecret
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

var mongoose   = require('mongoose');
mongoose.connect(config.mongodbURL);
var User       = require('./app/models/user');

var port = process.env.PORT || 8080;

// =============================================================================
// }}}
// =============================================================================

// =============================================================================
// PASSPORT CONFIG {{{
// =============================================================================


var isLogged = function(req, res, next) {
	if(req.isAuthenticated())
		return next();

	//res.redirect('/api/message/login');
	res.status(403).json({error: "You must be logged in to see this page"});
}

passport.serializeUser(function(user, done) {
	console.log("Serializing user " + user.id);
	done(null, user.id);
});

passport.deserializeUser(function(id, done) {
	User.findById(id, function(err, user) {
		console.log("Deserializing user " + id);
		done(err, user);
	});
});

passport.use(new GoogleStrategy(config.auth,
	function(token, refreshToken, profile, done) {
		process.nextTick(function() {
			User.findOne({'googleId': profile.id}, function(err, user) {
				if(err)
					return done(err);

				if(user) {
					return done(null, user);
				} else {
					var newUser         = new User();
					newUser.googleId    = profile.id;
					newUser.googleToken = token;
					newUser.name        = profile.displayName;
					newUser.email       = profile.emails[0].value;

					newUser.save(function(err) {
						if(err)
							throw err;
						return done(null, newUser);
					});
				}
			});
		});
	}
));


// =============================================================================
// }}}
// =============================================================================

// =============================================================================
// ROUTES FOR OUR MESSAGE API {{{
// =============================================================================


var router = express.Router();

router.use(function(req, res, next) {
	debug('URI /api/message' + req.path + ' Requested.');

	next();
});

router.get('/login',
                   passport.authenticate('google', {
                   	scope : ['profile', 'email']
                   }));

router.get('/login/callback',
                   passport.authenticate('google', {
                   	successRedirect: '/api/message/login/success',
                   	failureRedirect: '/api/message/login'
                   }));

router.get('/login/success', isLogged, function(req, res) {
	res.json({'message': 'You are successfully logged in'});
});

router.get('/users', isLogged, function(req, res) {
	User.find({}, function(err, users) {
		if(err)
			throw err;

		res.json(users);
	});
});

router.get("/user", isLogged, function(req, res) {
	res.json(req.user);
});

router.route("/user/clubs")
	.get(isLogged, function(req, res) {
		res.json(req.user.clubs);
	})

	.post(isLogged, function(req, res) {
		User.findById(req.user._id, function(err, user) {
			user.update({$addToSet: {clubs: req.body.club}},
			            function(err, msg) {
							if(err)
								return res.status(500).json(err);
			            	res.json(msg);
						});
		});
	})

	.delete(isLogged, function(req, res) {
		User.findById(req.user._id, function(err, user) {
			user.update({$pull: {clubs: req.body.club}},
			            function(err, msg) {
							if(err)
								return res.status(500).json(err);
			            	res.json(msg);
						});
		});
	});

app.use('/api/message/', router);

// =============================================================================
// }}}
// =============================================================================

// =============================================================================
// START THE SERVER {{{
// =============================================================================


app.listen(port);
console.log('Magic happens on port ' + port);


// =============================================================================
// }}}
// =============================================================================

// vim: fdm=marker
