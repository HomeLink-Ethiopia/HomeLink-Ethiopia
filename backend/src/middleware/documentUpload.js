const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'document-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    // We only check extname here because mimetypes for docs can vary widely (e.g., application/msword, application/pdf)
    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images (JPEG, PNG) and documents (PDF, DOC, DOCX) are allowed'));
    }
};

const documentUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for applications
    }
});

module.exports = documentUpload;
