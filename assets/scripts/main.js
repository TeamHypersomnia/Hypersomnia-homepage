function opn(e, name) {
  const tabcontents = document.querySelectorAll('.tabcontent');
  tabcontents.forEach(tabcontent => tabcontent.style.display = 'none');
  const tablinks = document.querySelectorAll('.tablinks');
  tablinks.forEach(tablink => tablink.classList.remove('active'));
  document.getElementById(name).style.display = 'block';
  e.currentTarget.classList.add('active');
}

function fast() {
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
  const fast = document.getElementsByClassName('fast');
  const strong = document.getElementsByClassName('strong');
  for (let i = 0; i < fast.length; i++) {
    fast[i].style.display = 'none';
  }
  for (let i = 0; i < strong.length; i++) {
    strong[i].style.display = 'inline';
  }
}

function send(url, formData) {
  return fetch(url, {
    method: 'POST',
    body: formData,
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.text();
  });
}

function updateCountdown() {
  const countDownDate = new Date("2023-09-23T14:30:00Z").getTime();
  const now = new Date().getTime();
  const distance = countDownDate - now;
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  const formatTime = (value) => (value < 10 ? "0" : "") + value;
  const timeString = (days > 0 ? `${days} days, ` : "") + `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
  const countdownElement = document.getElementById("countdown");
  countdownElement.innerHTML = distance < 0 ? "It's started, join now!" : `Starts in ${timeString}`;
}


document.addEventListener('DOMContentLoaded', function () {
  updateCountdown();
  setInterval(updateCountdown, 1000);
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
      console.error('Unable to copy: ', err);
    });
  });
});
