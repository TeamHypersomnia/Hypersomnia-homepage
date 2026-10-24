/*
  /generator: the config generator for hosting a server, on its own - centered on the dark background, nothing else.
  The guide to the rest is the game's README_SERVER.md on GitHub.
*/

const OFFICIAL_ARENAS = ['de_cyberaqua', 'de_silo', 'fy_minilab'];

// the arenas offered by the config generator: the official servers' bomb defusal cycle
const COMMUNITY_ARENAS = [
  'de_hotline', 'de_metro', 'de_duel_practice', 'de_jedrula', 'de_billan', 'de_kremlin', 'hyperactive_space_station',
  'fy_iceworld', 'de_rambo', 'de_amongus', 'de_bogosbinted', 'de_facing_worlds', 'de_suspect'
];

/*
  The generator's tabs: what the server is for, then how it runs - its own, apart from the guide.
*/

const GENERATOR_SETUPS = [
  { group: 'server', label: 'Persistent server', icon: 'fa-solid fa-server', members: [
    { id: 'server-appimage', label: 'AppImage', icon: 'fa-brands fa-linux', isDefault: true },
    { id: 'server-compose', label: 'Docker compose', icon: 'fa-brands fa-docker' },
    { id: 'server-run', label: 'Docker run', icon: 'fa-brands fa-docker' }
  ] },
  { group: 'tournament', label: 'Tournament', icon: 'fa-solid fa-trophy', members: [
    { id: 'tournament-appimage', label: 'AppImage', icon: 'fa-brands fa-linux' },
    { id: 'tournament-compose', label: 'Docker compose', icon: 'fa-brands fa-docker' },
    { id: 'tournament-run', label: 'Docker run', icon: 'fa-brands fa-docker' }
  ] }
];

function generatorTabs() {
  const def = m => m.isDefault ? ' data-default="1"' : '';

  return [
    '<div class="btn-group guide-setup-tabs">',
    ...GENERATOR_SETUPS.map(g => {
      const first = g.members.find(m => m.isDefault) || g.members[0];
      return `<div class="btn"><button type="button" data-group="${g.group}" data-setup="${first.id}"${def(first)}><i class="${g.icon}"></i>${g.label}</button></div>`;
    }),
    '</div>',
    ...GENERATOR_SETUPS.map(g => [
      `<div class="btn-group guide-setup-subtabs" data-group="${g.group}" id="${g.group}">`,
      ...g.members.map(m => `<div class="btn"><button type="button" data-group="${g.group}" data-setup="${m.id}"${def(m)}><i class="${m.icon}"></i>${m.label}</button></div>`),
      '</div>'
    ].join(''))
  ].join('');
}

module.exports = (req, res) => {
  res.render('generator', {
    tabs: generatorTabs(),
    arenas: {
      official: OFFICIAL_ARENAS,
      community: COMMUNITY_ARENAS
    }
  });
};
