const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
cloudinary.api.resources({ resource_type: 'video', max_results: 50 }, (error, result) => {
  if(error) console.error(error);
  else {
    result.resources.forEach(r => console.log(r.public_id, r.secure_url));
  }
});
