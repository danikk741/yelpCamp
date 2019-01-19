const express = require('express'),
	Campground = require('../models/campground'),
	router = express.Router(),
	middleware = require('../middleware/index'),
	NodeGeocoder = require('node-geocoder'),
	options = {
		provider: 'google',
		httpAdapter: 'https',
		apiKey: process.env.GEOCODER_API_KEY,
		formatter: null
	},
	geocoder = NodeGeocoder(options),
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
	},
	upload = multer({ storage: storage, fileFilter: imageFilter }),
	cloudinary = require('cloudinary');

cloudinary.config({
	cloud_name: 'danikk147',
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});

// INDEX
router.get('/', (req, res) => {
	let noMatch = null,
		perPage = 8,
		pageQuery = parseInt(req.query.page),
		pageNumber = pageQuery ? pageQuery : 1;
	if (req.query.search) {
		const regex = new RegExp(escapeRegex(req.query.search), 'gi');
		Campground.find({ name: regex })
			.skip(perPage * pageNumber - perPage)
			.limit(perPage)
			.exec((err, campgrounds) => {
				Campground.count().exec((err, count) => {
					if (err || !campgrounds) {
						req.flash('error', 'Campground not found');
						return res.redirect('back');
					}
					if (campgrounds.length < 1) {
						noMatch = 'No campgrounds match that query, please try again.';
					}
					res.render('campgrounds/index', {
						campgrounds: campgrounds,
						page: 'campgrounds',
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						noMatch: noMatch
					});
				});
			});
	} else {
		Campground.find({})
			.skip(perPage * pageNumber - perPage)
			.limit(perPage)
			.exec((err, campgrounds) => {
				Campground.count().exec((err, count) => {
					if (err || !campgrounds) {
						req.flash('error', 'Campground not found');
						return res.redirect('back');
					}
					res.render('campgrounds/index', {
						campgrounds: campgrounds,
						page: 'campgrounds',
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						noMatch: noMatch
					});
				});
			});
	}
});

// NEW
router.get('/new', middleware.isLoggedIn, (req, res) => {
	res.render('campgrounds/new');
});

// CREATE
router.post('/', middleware.isLoggedIn, upload.single('image'), (req, res) => {
	geocoder.geocode(req.body.location, (err, data) => {
		if (err || !data.length) {
			req.flash('error', err.message);
			return res.redirect('back');
		}
		cloudinary.v2.uploader.upload(req.file.path, (err, result) => {
			if (err) {
				req.flash('error', err.message);
				return res.redirect('back');
			}
			let name = req.body.name,
				price = req.body.price,
				image = result.secure_url,
				imageId = result.public_id,
				description = req.body.description,
				author = {
					id: req.user._id,
					username: req.user.username
				},
				lat = data[0].latitude,
				lng = data[0].longitude,
				location = data[0].formattedAddress,
				newCamp = {
					name: name,
					image: image,
					imageId: imageId,
					description: description,
					author: author,
					location: location,
					lat: lat,
					lng: lng,
					price: price
				};
			Campground.create(newCamp, (err, camp) => {
				if (err) {
					req.flash('error', err.message);
					return res.redirect('/campgrounds/new');
				}
				res.redirect('/campgrounds/' + camp.id);
			});
		});
	});
});

// SHOW
router.get('/:id', (req, res) => {
	Campground.findById(req.params.id)
		.populate('comments')
		.exec((err, foundCampground) => {
			if (err || !foundCampground) {
				req.flash('error', 'Campground not found');
				return res.redirect('/campgrounds');
			}
			res.render('campgrounds/show', { campground: foundCampground });
		});
});

// EDIT
router.get('/:id/edit', middleware.checkCampOwner, (req, res) => {
	Campground.findById(req.params.id, (err, foundCampground) => {
		if (err || !foundCampground) {
			req.flash('error', 'Campground not found');
			res.redirect('/campgrounds');
		}
		res.render('campgrounds/edit', { campground: foundCampground });
	});
});

// UPDATE
router.put(
	'/:id',
	middleware.checkCampOwner,
	upload.single('image'),
	(req, res) => {
		geocoder.geocode(req.body.location, (err, data) => {
			if (err || !data.length) {
				req.flash('error', 'Invalid address');
				return res.redirect('/campgrounds');
			}
			req.body.camp.lat = data[0].latitude;
			req.body.camp.lng = data[0].longitude;
			req.body.camp.location = data[0].formattedAddress;

			Campground.findByIdAndUpdate(
				req.params.id,
				req.body.camp,
				async (err, foundCampground) => {
					if (err || !foundCampground) {
						req.flash('error', 'Campground not found');
						return res.redirect('/campgrounds');
					}
					if (req.file) {
						try {
							await cloudinary.v2.uploader.destroy(foundCampground.imageId);
							var result = await cloudinary.v2.uploader.upload(req.file.path);
							foundCampground.imageId = result.public_id;
							foundCampground.image = result.secure_url;
						} catch (err) {
							req.flash('error', err.message);
							return res.redirect('back');
						}
					}
					foundCampground.name = req.body.camp.name;
					foundCampground.description = req.body.camp.description;
					foundCampground.save();
					req.flash('success', 'Campground has changed!');
					res.redirect('/campgrounds/' + req.params.id);
				}
			);
		});
	}
);

// DELETE
router.delete('/:id', middleware.checkCampOwner, (req, res) => {
	Campground.findById(req.params.id, async (err, foundCampground) => {
		if (err || !foundCampground) {
			req.flash('error', 'Campground not found');
			return res.redirect('/campgrounds');
		}
		try {
			await cloudinary.v2.uploader.destroy(foundCampground.imageId);
			foundCampground.remove();
			req.flash('success', 'Campground deleted');
			res.redirect('/campgrounds');
		} catch (err) {
			req.flash('error', err.message);
			return res.redirect('/campgrounds');
		}
	});
});

function escapeRegex(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

module.exports = router;
