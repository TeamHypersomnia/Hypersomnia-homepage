const fs = require('fs');
const path = require('path');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const arenas = require(__dirname + '/arenas');
const servers = require(__dirname + '/servers');
const commits = require(__dirname + '/commits');
const weapons = require(__dirname + '/weapons');
const system = require(__dirname + '/admin/system');
const settings = require(__dirname + '/admin/settings');

arenas.init();
servers.init();
commits.init();

function onlyUserAccess(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/steam');
  }
  return next();
}

function onlyAdminAccess(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/steam');
  }
  const admins = process.env.ADMINS.split(',');
  if (!admins.includes(req.user.id)) {
    return res.redirect('/');
  }
  return next();
}

function writeFileWithDirectory(filePath, content) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
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
    const obj = arenas.getArenas();
    if (req.query.format !== undefined && req.query.format == 'json') {
      return res.json(obj);
    }
    res.render('arenas', {
      page: 'Arenas',
      user: req.user,
      arenas: obj
    });
  });

  app.get('/arenas/:arena', function (req, res) {
    const obj = arenas.getArenas();
    const index = obj.findIndex(v => v.name === req.params.arena);
    if (index === -1) {
      return res.redirect('/arenas');
    }
    let prev = obj[obj.length - 1].name;
    if (obj[index - 1] !== undefined) {
      prev = obj[index - 1].name;
    }
    let next = obj[0].name;
    if (obj[index + 1] !== undefined) {
      next = obj[index + 1].name;
    }
    res.render('arena', {
      page: obj[index].name,
      user: req.user,
      arena: obj[index],
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

  app.get('/disclaimer', function (req, res) {
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

  app.get('/profile', onlyUserAccess, function (req, res) {
    res.render('profile', {
      page: 'Profile',
      user: req.user
    });
  });

  app.get('/admin', onlyAdminAccess, function (req, res) {
    res.redirect('/admin/system');
  });

  app.get('/admin/system', onlyAdminAccess, function (req, res) {
    res.render('admin/system', {
      page: 'System',
      user: req.user,
      system: system.getData()
    });
  });

  app.get('/admin/visitors', onlyAdminAccess, function (req, res) {
    res.render('admin/visitors', {
      page: 'Visitors',
      user: req.user
    });
  });

  app.get('/admin/users', onlyAdminAccess, function (req, res) {
    res.render('admin/users', {
      page: 'Users',
      user: req.user
    });
  });

  app.get('/admin/creators', onlyAdminAccess, function (req, res) {
    res.render('admin/creators', {
      page: 'Creators',
      user: req.user
    });
  });

  app.get('/admin/settings', onlyAdminAccess, function (req, res) {
    res.render('admin/settings', {
      page: 'Settings',
      user: req.user,
      alert: app.locals.alert
    });
  });

  app.post('/admin/settings', onlyAdminAccess, function (req, res) {
    const alert = req.body.alert;
    app.locals.alert = alert;
    const obj = settings.load();
    obj.alert = alert;
    settings.save(obj);
    res.redirect('/admin/settings');
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