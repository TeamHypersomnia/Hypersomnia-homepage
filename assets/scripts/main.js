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

document.addEventListener('DOMContentLoaded', function () {
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
