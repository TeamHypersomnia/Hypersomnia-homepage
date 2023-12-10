const fs = require('fs');
const path = require('path');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const arenas = require(__dirname + '/arenas')();
const servers = require(__dirname + '/servers');
const commits = require(__dirname + '/commits');
const weapons = require(__dirname + '/weapons');

servers.init();
commits.init();

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/steam');
}

function ensurePathExists(filePath) {
  const directories = filePath.split(path.sep);
  let currentPath = '';
  for (const directory of directories) {
    currentPath = path.join(currentPath, directory);
    if (!fs.existsSync(currentPath)) {
      fs.mkdirSync(currentPath);
    }
  }
}

module.exports = function (app, passport) {
  app.get('/', function (req, res) {
    res.render('index', {
      page: 'Index',
      user: req.user,
      commits: commits.getCommits()
    });
  });

  app.get('/guide', function (req, res) {
    res.render('guide', {
      page: 'Guide',
      user: req.user
    });
  });

  app.get('/arenas', function (req, res) {
    if (req.query.format !== undefined && req.query.format == 'json') {
      return res.json(arenas);
    }
    res.render('arenas', {
      page: 'Arenas',
      user: req.user,
      arenas: arenas
    });
  });

  app.get('/arenas/:arena', function (req, res) {
    const index = arenas.findIndex(v => v.name === req.params.arena);
    if (index === -1) {
      return res.redirect('/arenas');
    }
    let prev = arenas[arenas.length - 1].name;
    if (arenas[index - 1] !== undefined) {
      prev = arenas[index - 1].name;
    }
    let next = arenas[0].name;
    if (arenas[index + 1] !== undefined) {
      next = arenas[index + 1].name;
    }
    res.render('arena', {
      page: arenas[index].name,
      user: req.user,
      arena: arenas[index],
      prev: prev,
      next: next
    });
  });

  app.get('/weapons', function (req, res) {
    res.render('weapons', {
      page: 'Weapons',
      user: req.user,
      firearms: weapons.getFirearms(),
      melees: weapons.getMelees(),
      explosives: weapons.getExplosives(),
      spells: weapons.getSpells()
    });
  });

  app.get('/servers', function (req, res) {
    res.render('servers', {
      page: 'Servers',
      user: req.user,
      servers: servers.getServers()
    });
  });

  app.get('/servers/:address', function (req, res) {
    const list = servers.getServers();
    const sv = list.find(v => v.ip === req.params.address);
    if (sv === undefined) {
      return res.redirect('/servers');
    }
    res.render('server', {
      page: sv.name,
      user: req.user,
      sv: sv
    });
  });

  app.get('/Disclaimer', function (req, res) {
    res.render('disclaimer', {
      page: 'Disclaimer',
      user: req.user
    });
  });

  app.get('/cookie-policy', function (req, res) {
    res.render('cookie_policy', {
      page: 'Cookie Policy',
      user: req.user
    });
  });

  app.get('/press', function (req, res) {
    res.redirect('https://github.com/TeamHypersomnia/PressKit/blob/main/README.md#intro');
  });

  app.get('/contact', function (req, res) {
    res.render('contact', {
      page: 'Contact',
      user: req.user
    });
  });

  app.get('/profile', ensureAuthenticated, function (req, res) {
    res.render('profile', {
      page: 'Profile',
      user: req.user
    });
  });

  app.post('/upload', upload.single('upload'), (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
    const apikey = req.body.apikey;
    const arena = req.body.arena;
    const filename = req.body.filename;
    if (!apikey || !arena || !filename) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    const jsonData = fs.readFileSync(__dirname + '/../private/authorized_mappers.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    const authorizedMappers = JSON.parse(jsonData);
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
  
    const fileName = req.file.originalname;
    const fileContent = req.file.buffer;
    const filePath = __dirname + `/../public/arenas/${arena}/${filename}`;
    ensurePathExists(filePath);
    fs.writeFileSync(filePath, fileContent);
    console.log('File saved to:', filePath);
  
    return res.json({
      success: 'The file has been uploaded'
    });
  });

  app.post('/logout', function (req, res, next) {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });

  app.get('/auth/steam',
    passport.authenticate('steam', {
      failureRedirect: '/'
    }),
    function (req, res) {
      res.redirect('/');
    });

  app.get('/auth/steam/return',
    passport.authenticate('steam', {
      failureRedirect: '/'
    }),
    function (req, res) {
      res.redirect('/');
    });

  app.use((req, res, next) => {
    res.status(404).render('404', {
      page: 'Not Found',
      user: req.user
    });
  });
}