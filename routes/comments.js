const express = require('express'),
	Campground = require('../models/campground'),
	Comment = require('../models/comment'),
	router = express.Router({ mergeParams: true }),
	middleware = require('../middleware/index');

// NEW
router.get('/new', middleware.isLoggedIn, (req, res) => {
	Campground.findById(req.params.id, (err, foundCampground) => {
		if (err || !foundCampground) {
			req.flash('error', 'Campground not found');
			return res.redirect('/campgrounds' + req.params.id);
		}
		res.render('comments/new', { campground: foundCampground });
	});
});

// CREATE
router.post('/', middleware.isLoggedIn, (req, res) => {
	Campground.findById(req.params.id, (err, foundCampground) => {
		if (err || !foundCampground) {
			req.flash('error', 'Campground not found...');
			return res.redirect('/campgrounds');
		}
		Comment.create(req.body.comment, (err, comment) => {
			if (err || !comment) {
				req.flash('error', 'Something went wrong...');
				return res.redirect('/campgrounds');
			}
			comment.author.id = req.user._id;
			comment.author.username = req.user.username;
			comment.save();
			foundCampground.comments.push(comment);
			foundCampground.save();
			req.flash('success', 'Successfully added comment!');
			res.redirect('/campgrounds/' + req.params.id);
		});
	});
});

// EDIT
router.get('/:comment_id/edit', middleware.checkCommentOwner, (req, res) => {
	Campground.findById(req.params.id, (err, foundCampground) => {
		if (err || !foundCampground) {
			req.flash('error', 'Campground not found');
			return res.redirect('/campgrounds' + req.params.id);
		}
		Comment.findById(req.params.comment_id, (err, foundComment) => {
			if (err || !foundComment) {
				req.flash('error', 'Comment not found');
				return res.redirect('/campgrounds' + req.params.id);
			}
			res.render('comments/edit', {
				campground_id: req.params.id,
				comment: foundComment
			});
		});
	});
});

// UPDATE
router.put('/:comment_id', middleware.checkCommentOwner, (req, res) => {
	Comment.findByIdAndUpdate(
		req.params.comment_id,
		req.body.comment,
		(err, updatedComment) => {
			if (err || !updatedComment) {
				req.flash('error', 'Comment not found');
				return res.redirect('/campgrounds' + req.params.id);
			}
			req.flash('success', 'Comment updated');
			res.redirect('/campgrounds/' + req.params.id);
		}
	);
});

// DELETE
router.delete('/:comment_id', middleware.checkCommentOwner, (req, res) => {
	Comment.findByIdAndRemove(req.params.comment_id, err => {
		if (err) {
			req.flash('error', err.message);
			return res.redirect('/campgrounds/' + req.params.id);
		}
		req.flash('success', 'Comment deleted!');
		res.redirect('/campgrounds/' + req.params.id);
	});
});

module.exports = router;
