const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function writeFileWithDirectory(filePath, content) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

router.post('/', upload.single('upload'), (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const apikey = req.body.apikey;
  const arena = req.body.arena;
  const filename = req.body.filename;
  if (!apikey || !arena || !filename) {
    return res.status(400).json({
      error: 'Missing required parameters'
    });
  }

  const d = fs.readFileSync(__dirname + '/../private/authorized_mappers.json', {
    encoding: 'utf8',
    flag: 'r'
  });
  const authorizedMappers = JSON.parse(d);
  if (!authorizedMappers[apikey]) {
    return res.status(400).json({
      error: 'You are not authorized to upload maps'
    });
  }
  
  let allowCreatingNew = false;
  if (authorizedMappers[apikey].allow_creating_new === 1) {
    allowCreatingNew = true;
  }
  
  const arenas = authorizedMappers[apikey]?.maps || [];
  if (!allowCreatingNew && !arenas.includes(arena)) {
    return res.status(400).json({
      error: 'You are not authorized to create new maps'
    });
  } else if (allowCreatingNew) {
    const owner = Object.keys(authorizedMappers).find(
      (key) => authorizedMappers[key].maps && authorizedMappers[key].maps.includes(arena)
    );
    if (owner && owner !== apikey) {
      return res.status(400).json({
        error: 'You are not authorized to upload a map with this name'
      });
    }
  }
  
  const allowed = ['json', 'png', 'jpg', 'gif', 'ogg', 'wav'];
  const ext = path.extname(req.file.originalname).slice(1);
  const ext2 = path.extname(filename).slice(1);
  if (!allowed.includes(ext) || !allowed.includes(ext2)) {
    return res.status(400).json({
      error: 'You are not allowed to upload this file type'
    });
  }
  
  // Avoid directory traversal attacks
  const sanitizedFilename = filename.replace(/\\/g, '/');
  const pathComponents = sanitizedFilename.split('/');
  for (const component of pathComponents) {
    if (component === '.' || component === '..') {
      return res.status(400).json({
        error: 'Parameter filename is invalid'
      });
    }
  }

  const filePath = `public/arenas/${arena}/${sanitizedFilename}`;
  writeFileWithDirectory(filePath, req.file.buffer);
  console.log(`File saved to ${filePath}`);

  return res.json({
    success: 'The file has been uploaded'
  });
});

module.exports = router;
