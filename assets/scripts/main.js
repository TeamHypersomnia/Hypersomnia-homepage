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

window.addEventListener("load", (event) => {
  if (document.getElementsByClassName('notes').length > 0) {
    tippy('.notes', {
      content(reference) {
        const title = reference.getAttribute('title');
        reference.removeAttribute('title');
        return title;
      },
    });
  }
});
