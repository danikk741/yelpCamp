const express = require('express'),
	router = express.Router(),
	passport = require('passport'),
	User = require('../models/user'),
	middleware = require('../middleware/index'),
	Campground = require('../models/campground'),
	async = require('async'),
	nodemailer = require('nodemailer'),
	crypto = require('crypto'),
	multer = require('multer'),
	storage = multer.diskStorage({
		filename: function(req, file, callback) {
			callback(null, Date.now() + file.originalname);
		}
	}),
	imageFilter = function(req, file, cb) {
		// accept image files only
		if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
			return cb(new Error('Only image files are allowed!'), false);
		}
		cb(null, true);
	};

const upload = multer({ storage: storage, fileFilter: imageFilter }),
	cloudinary = require('cloudinary');
cloudinary.config({
	cloud_name: 'danikk147',
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/', (req, res) => {
	res.render('landing');
});

// REGISTER
router.get('/register', (req, res) => {
	res.render('register', { page: 'register' });
});

router.post('/register', upload.single('image'), (req, res) => {
	cloudinary.v2.uploader
		.upload(req.file.path)
		.then(result => {
			let newUser = new User({
				username: req.body.username,
				firstName: req.body.firstName,
				lastName: req.body.lastName,
				avatar: result.secure_url,
				avatarId: result.public_id,
				email: req.body.email
			});
			if (req.body.adminCode === 'azaza') {
				newUser.isAdmin = true;
			}
			User.register(newUser, req.body.password, (err, user) => {
				if (err) {
					req.flash('error', err.message);
					return res.render('register');
				}
				passport.authenticate('local')(req, res, () => {
					req.flash('success', 'Welcome to YelpCamp, ' + user.username + '!');
					res.redirect('/campgrounds');
				});
			});
		})
		.catch(err => {
			req.flash('error', err.message);
			return res.redirect('back');
		});
});

// LOGIN
router.get('/login', (req, res) => {
	res.render('login', { page: 'login' });
});

router.post(
	'/login',
	passport.authenticate('local', {
		successRedirect: '/campgrounds',
		failureRedirect: '/login'
	}),
	(req, res) => {}
);

// LOGOUT
router.get('/logout', (req, res) => {
	req.logout();
	req.flash('success', 'Logged you out!');
	res.redirect('/campgrounds');
});

// USER PROFILE
router.get('/users/:id', (req, res) => {
	User.findById(req.params.id, (err, foundUser) => {
		if (err || !foundUser) {
			req.flash('error', 'Something went wrong...');
			return res.redirect('/campgrounds');
		}
		Campground.find()
			.where('author.id')
			.equals(foundUser._id)
			.exec((err, campgrounds) => {
				if (err) {
					req.flash('error', 'Something went wrong...');
					return res.redirect('/campgrounds');
				}
				res.render('users/show', {
					user: foundUser,
					campgrounds: campgrounds
				});
			});
	});
});

router.get('/users/:id/edit', middleware.checkUserOwner, (req, res) => {
	User.findById(req.params.id)
		.then(foundUser => {
			if (!foundUser) {
				req.flash('error', 'User not found');
				return res.redirect('back');
			}
			res.render('users/edit', { user: foundUser });
		})
		.catch(err => {
			req.flash('error', err.message);
			res.redirect('/users/' + req.params.id);
		});
});

router.put(
	'/users/:id',
	middleware.checkUserOwner,
	upload.single('image'),
	(req, res) => {
		User.findByIdAndUpdate(req.params.id, req.body.user)
			.then(async foundUser => {
				if (!foundUser) {
					req.flash('error', 'User not found');
					return res.redirect('back');
				}
				if (req.file) {
					try {
						await cloudinary.v2.uploader.destroy(foundUser.avatarId);
						let result = await cloudinary.v2.uploader.upload(req.file.path);
						foundUser.avatarId = result.public_id;
						foundUser.avatar = result.secure_url;
					} catch (err) {
						req.flash('error', err.message);
						return res.redirect('back');
					}
				}
				foundUser.firstName = req.body.user.firstName;
				foundUser.lastName = req.body.user.lastName;
				foundUser.email = req.body.user.email;
				foundUser.save();
				req.flash('success', 'Profile has edited!');
				res.redirect('/users/' + req.params.id);
			})
			.catch(err => {
				req.flash('error', err.message);
				res.redirect('/users/' + req.params.id);
			});
	}
);

// FORGOT PASSWORD
router.get('/forgot', (req, res) => {
	res.render('forgot');
});

router.post('/forgot', (req, res, next) => {
	async.waterfall(
		[
			done => {
				crypto.randomBytes(20, (err, buf) => {
					var token = buf.toString('hex');
					done(err, token);
				});
			},
			(token, done) => {
				User.findOne({ email: req.body.email }, (err, user) => {
					if (err || !user) {
						req.flash('error', 'No account with that email address exists.');
						return res.redirect('/forgot');
					}

					user.resetPasswordToken = token;
					user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

					user.save(err => {
						done(err, token, user);
					});
				});
			},
			(token, user, done) => {
				let smtpTransport = nodemailer.createTransport({
					service: 'Gmail',
					secure: false,
					port: 25,
					auth: {
						user: 'beksoltanov98@gmail.com',
						pass: process.env.GMAILPW
					},
					tls: { rejectUnauthorized: false }
				});
				let mailOptions = {
					to: user.email,
					from: 'beksoltanov98@gmail.com',
					subject: 'Node.js Password Reset',
					text:
						'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
						'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
						'http://' +
						req.headers.host +
						'/reset/' +
						token +
						'\n\n' +
						'If you did not request this, please ignore this email and your password will remain unchanged.\n'
				};
				smtpTransport.sendMail(mailOptions, err => {
					req.flash(
						'success',
						'An e-mail has been sent to ' +
							user.email +
							' with further instructions.'
					);
					done(err, 'done');
				});
			}
		],
		err => {
			if (err) return next(err);
			res.redirect('/forgot');
		}
	);
});

router.get('/reset/:token', (req, res) => {
	User.findOne(
		{
			resetPasswordToken: req.params.token,
			resetPasswordExpires: { $gt: Date.now() }
		},
		(err, user) => {
			if (err || !user) {
				req.flash('error', 'Password reset token is invalid or has expired.');
				return res.redirect('/forgot');
			}
			res.render('reset', { token: req.params.token });
		}
	);
});

router.post('/reset/:token', (req, res) => {
	async.waterfall(
		[
			done => {
				User.findOne(
					{
						resetPasswordToken: req.params.token,
						resetPasswordExpires: { $gt: Date.now() }
					},
					(err, user) => {
						if (err || !user) {
							req.flash(
								'error',
								'Password reset token is invalid or has expired.'
							);
							return res.redirect('/forgot');
						}
						if (req.body.password === req.body.confirm) {
							user.setPassword(req.body.password, err => {
								user.resetPasswordToken = undefined;
								user.resetPasswordExpires = undefined;

								user.save(err => {
									req.logIn(user, err => {
										done(err, user);
									});
								});
							});
						} else {
							req.flash('error', 'Passwords do not match.');
							return res.redirect('back');
						}
					}
				);
			},
			(user, done) => {
				let smtpTransport = nodemailer.createTransport({
					service: 'Gmail',
					secure: false,
					port: 25,
					auth: {
						user: 'beksoltanov98@gmail.com',
						pass: process.env.GMAILPW
					},
					tls: { rejectUnauthorized: false }
				});
				let mailOptions = {
					to: user.email,
					from: 'beksoltanov98@gmail.com',
					subject: 'Your password has been changed',
					text:
						'Hello,\n\n' +
						'This is a confirmation that the password for your account ' +
						user.email +
						' has just been changed.\n'
				};
				smtpTransport.sendMail(mailOptions, err => {
					req.flash('success', 'Success! Your password has been changed.');
					done(err);
				});
			}
		],
		err => {
			res.redirect('/campgrounds');
		}
	);
});

module.exports = router;
