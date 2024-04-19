function opn(e, name) {
  const tabcontents = document.querySelectorAll('.tabcontent');
  tabcontents.forEach(tabcontent => tabcontent.style.display = 'none');
  const tablinks = document.querySelectorAll('.tablinks');
  tablinks.forEach(tablink => tablink.classList.remove('active'));
  document.getElementById(name).style.display = 'block';
  e.currentTarget.classList.add('active');
}

function fast() {
  const fastBtn = document.querySelector('.fastBtn');
  const strongBtn = document.querySelector('.strongBtn');
  fastBtn.classList.add('active');
  strongBtn.classList.remove('active');

  const fast = document.getElementsByClassName('fast');
  const strong = document.getElementsByClassName('strong');
  for (let i = 0; i < fast.length; i++) {
    fast[i].style.display = 'inline';
  }
  for (let i = 0; i < strong.length; i++) {
    strong[i].style.display = 'none';
  }
}

function strong() {
  const fastBtn = document.querySelector('.fastBtn');
  const strongBtn = document.querySelector('.strongBtn');
  fastBtn.classList.remove('active');
  strongBtn.classList.add('active');

  const fast = document.getElementsByClassName('fast');
  const strong = document.getElementsByClassName('strong');
  for (let i = 0; i < fast.length; i++) {
    fast[i].style.display = 'none';
  }
  for (let i = 0; i < strong.length; i++) {
    strong[i].style.display = 'inline';
  }
}

function countdown(countdownElement, countdownContent) {
  const targetDate = new Date(countdownElement.getAttribute('data-date'));
  const currentDate = new Date();
  const timeRemaining = targetDate - currentDate;
  if (timeRemaining > 0) {
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    const formatTime = (value) => (value < 10 ? "0" : "") + value;
    const timeString = (days > 0 ? `${days} days, ` : "") + `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
    countdownElement.textContent = countdownContent + ' ' + timeString;
  } else {
    const endText = new Date(countdownElement.getAttribute('data-end'));
    countdownElement.textContent = endText;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const countdownElement = document.querySelector('.countdown');
  if (countdownElement) {
    const countdownContent = countdownElement.textContent;
    countdown(countdownElement, countdownContent);
    setInterval(function() {
      countdown(countdownElement, countdownContent);
    }, 1000);
  }
  const videoList = document.querySelectorAll('.yt li');
  videoList.forEach(videoItem => {
    const code = videoItem.getAttribute('data-code');
    videoItem.style.backgroundImage = `url(https://i.ytimg.com/vi_webp/${code}/hqdefault.webp)`;
    videoItem.addEventListener('click', () => {
      const youtubeURL = `//www.youtube.com/watch?v=${code}`;
      window.open(youtubeURL, '_blank');
    });
  });
});

const copyButtons = document.querySelectorAll('.copy');
copyButtons.forEach(button => {
  button.addEventListener('click', () => {
    const closestTocopy = button.closest('.tocopy');
    const contentToCopy = closestTocopy.querySelector('code').textContent;
    const textItem = new ClipboardItem({ 'text/plain': new Blob([contentToCopy], { type: 'text/plain' }) });
    navigator.clipboard.write([textItem]).then(() => {
      button.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => {
        button.innerHTML = '<i class="fa-solid fa-copy"></i>';
      }, 1000);
    }).catch(err => {
      console.error(err);
    });
  });
});

const prot = (window.location.protocol === 'https:' ? 'wss:' : 'ws:')
const host = window.location.hostname;
const port = window.location.port;
const ws = new WebSocket(prot + '//' + host + ':' + port);

const website_visitor = document.getElementById('website_visitor');
const players_ingame = document.getElementById('players_ingame');
const online_servers = document.getElementById('online_servers');

ws.onmessage = function(event) {
  const d = JSON.parse(event.data);
  website_visitor.textContent = d.website_visitor;
  players_ingame.textContent = d.players_ingame;
  online_servers.textContent = d.online_servers;
};

ws.onerror = function(event) {
  console.error(event);
};
