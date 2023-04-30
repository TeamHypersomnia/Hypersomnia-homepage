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
