require('dotenv').config();

const PORT = process.env.PORT || 3000;

const express = require('express'),
	app = express(),
	mongoose = require('mongoose'),
	bodyParser = require('body-parser'),
	passport = require('passport'),
	LocalStrategy = require('passport-local'),
	User = require('./models/user'),
	methodOverride = require('method-override'),
	flash = require('connect-flash');

const commentRoutes = require('./routes/comments'),
	campgroundRoutes = require('./routes/campgrounds'),
	authRoutes = require('./routes/auth');

const url = process.env.DATABASEURL || 'mongodb://localhost/yelp';
mongoose.connect(url);

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));
app.use(flash());
app.locals.moment = require('moment');

// PASSPORT
app.use(
	require('express-session')({
		secret: 'param param pam',
		resave: false,
		saveUninitialized: false
	})
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next) {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash('error');
	res.locals.success = req.flash('success');
	next();
});

// ROUTES
app.use('/campgrounds/:id/comments', commentRoutes);
app.use(authRoutes);
app.use('/campgrounds', campgroundRoutes);

app.get('*', (req, res) => {
	res.send('Wrong url...');
});

// LISTEN
app.listen(PORT, () => {
	console.log('Server has started on port ' + PORT);
});
