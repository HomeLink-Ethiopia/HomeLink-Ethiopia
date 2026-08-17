const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'uploads/'

if(!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir,{recursive:true});
}

const storage = multer.diskStorage({
    destination:(req,file,fs) =>{
        cb(null, uploadDir);
    },

    filename:(req,file,cb)=>{
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random()*1E9);
        cb(null, uniqueSuffix+path.extname(file.originalname));
    }
});

const fileFilter = (req, file,cb) =>{
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype= allowedTypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits:{
        fileSize:5*1024*1024
    }
});

module.exports= upload;