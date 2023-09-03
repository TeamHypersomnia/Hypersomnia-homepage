function openTab(evt, cityName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(cityName).style.display = "block";
  evt.currentTarget.className += " active";
}

function topnav() {
  var x = document.getElementById("myTopnav");
  if (x.className === "topnav") {
    x.className += " responsive";
  } else {
    x.className = "topnav";
  }
}

function fast() {
  var fast = document.getElementsByClassName("fast");
  var strong = document.getElementsByClassName("strong");
  for (let i = 0; i < fast.length; i++) {
    fast[i].style.display = "inline";
  }
  for (let i = 0; i < strong.length; i++) {
    strong[i].style.display = "none";
  }
}

function strong() {
  var fast = document.getElementsByClassName("fast");
  var strong = document.getElementsByClassName("strong");
  for (let i = 0; i < fast.length; i++) {
    fast[i].style.display = "none";
  }
  for (let i = 0; i < strong.length; i++) {
    strong[i].style.display = "inline";
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var videoList = document.querySelectorAll('.video-t li');
  if (videoList.length > 0) {
    videoList.forEach(function(videoItem) {
      var code = videoItem.getAttribute('data-code');
      videoItem.style.backgroundImage = "url(https://img.youtube.com/vi/" + code + "/0.jpg)";
      videoItem.addEventListener('click', function() {
        var youtubeURL = "//www.youtube.com/watch?v=" + code;
        window.open(youtubeURL, '_blank');
      });
    });
  }
});

const copyButtons = document.querySelectorAll('.copy-button');
copyButtons.forEach(button => {
  button.addEventListener('click', () => {
    const closestTocopy = button.closest('.tocopy');
    const contentToCopy = closestTocopy.querySelector('code').textContent;
    const textItem = new ClipboardItem({ 'text/plain': new Blob([contentToCopy], { type: 'text/plain' }) });
    navigator.clipboard.write([textItem]).then(() => {
      button.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
          button.innerHTML = '<i class="fas fa-copy"></i>';
      }, 1000);
    }).catch(err => {
        console.error('Unable to copy: ', err);
    });
  });
});
