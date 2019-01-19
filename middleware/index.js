const Campground = require('../models/campground'),
	Comment = require('../models/comment'),
	User = require('../models/user');

var middlewareObject = {};

middlewareObject.isLoggedIn = function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	req.flash('error', 'You need to be logged in to do that!');
	res.redirect('/login');
};

middlewareObject.checkCampOwner = function checkCampOwner(req, res, next) {
	if (req.isAuthenticated()) {
		Campground.findById(req.params.id, (err, foundCampground) => {
			if (err || !foundCampground) {
				req.flash('error', 'Campground not found');
				return res.redirect('/campgrounds');
			}
			if (
				(req.user._id && foundCampground.author.id.equals(req.user._id)) ||
				(req.user._id && req.user.isAdmin)
			) {
				next();
			} else {
				req.flash('error', 'You do not have permission to do that!');
				res.redirect('/campgrounds/' + foundCampground._id);
			}
		});
	} else {
		req.flash('error', 'You need to be logged in to do that!');
		res.redirect('/login');
	}
};

middlewareObject.checkCommentOwner = function checkCommentOwner(
	req,
	res,
	next
) {
	if (req.isAuthenticated()) {
		Comment.findById(req.params.comment_id, (err, foundComment) => {
			if (err) {
				req.flash('error', 'Comment not found');
				return res.redirect('/campgrounds/');
			}
			if (
				foundComment.author.id.equals(req.user._id) ||
				(req.user._id && req.user.isAdmin)
			) {
				next();
			} else {
				req.flash('error', 'You do not have permission to do that!');
				res.redirect('/campgrounds/');
			}
		});
	} else {
		req.flash('error', 'You need to be logged in to do that!');
		res.redirect('/login');
	}
};

middlewareObject.checkUserOwner = function checkUserOwner(req, res, next) {
	if (req.isAuthenticated()) {
		User.findById(req.params.id, (err, foundUser) => {
			if (err || !foundUser) {
				req.flash('error', 'Campground not found');
				return res.redirect('/campgrounds');
			}
			if (
				(req.user._id && foundUser._id.equals(req.user._id)) ||
				(req.user._id && req.user.isAdmin)
			) {
				next();
			} else {
				req.flash('error', 'You do not have permission to do that!');
				res.redirect('/users/' + foundUser._id);
			}
		});
	} else {
		req.flash('error', 'You need to be logged in to do that!');
		res.redirect('/login');
	}
};

module.exports = middlewareObject;
