function topnav() {
	var x = document.getElementById("myTopnav");
	if (x.className === "topnav") {
		x.className += " responsive";
	} else {
		x.className = "topnav";
	}
}

function average(x, y) {
	return ((x+y)/2);
}

function parse_firearms(json) {
	var table = document.getElementById("firearms").getElementsByTagName("tbody")[0];
	Object.entries(json).forEach(([k, v]) => {
		var row = table.insertRow(-1);
		var c1 = row.insertCell(0);
		var c2 = row.insertCell(1);
		var c3 = row.insertCell(2);
		var c4 = row.insertCell(3);
		var c5 = row.insertCell(4);
		var c6 = row.insertCell(5);
		var c7 = row.insertCell(6);
		var c8 = row.insertCell(7);
		var c9 = row.insertCell(8);
		c1.innerHTML = v.display_name;
		c2.innerHTML = `<img src="https://raw.githubusercontent.com/TeamHypersomnia/Hypersomnia/master/hypersomnia/content/gfx/${v.pic_filename}">`;
		c3.innerHTML = v.damage;
		c4.innerHTML = v.headshot_damage;
		c5.innerHTML = v.shots_per_second.toFixed(2);
		c6.innerHTML = average(v.min_bullet_speed, v.max_bullet_speed);
		c7.innerHTML = v.price;
		c8.innerHTML = v.kill_award;
		c9.innerHTML = v.weight.toFixed(2);
	});
	const el = document.querySelector("#firearms > thead > tr > th:nth-child(7)");
	if (el) {
		el.click();
		el.click();
	}
}

function parse_meeles(json) {
	var table = document.getElementById("melees").getElementsByTagName("tbody")[0];
	Object.entries(json).forEach(([k, v]) => {
		var row = table.insertRow(-1);
		var c1 = row.insertCell(0);
		var c2 = row.insertCell(1);
		var c3 = row.insertCell(2);
		var c4 = row.insertCell(3);
		var c5 = row.insertCell(4);
		var c6 = row.insertCell(5);
		var c7 = row.insertCell(6);
		var c8 = row.insertCell(7);
		var c9 = row.insertCell(8);
		var c10 = row.insertCell(9);
		var c11 = row.insertCell(10);
		c1.innerHTML = v.display_name;
		c2.innerHTML = `<img src="https://raw.githubusercontent.com/TeamHypersomnia/Hypersomnia/master/hypersomnia/content/gfx/${v.pic_filename}">`;
		c3.innerHTML = `<span class="fast">${v.fast_swings_per_second.toFixed(2)}</span><span class="strong">${v.strong_swings_per_second.toFixed(2)}</span>`;
		c4.innerHTML = `<span class="fast">${v.fast_damage}</span><span class="strong">${v.strong_damage}</span>`;
		c5.innerHTML = `<span class="fast">${v.fast_hs_damage}</span><span class="strong">${v.strong_hs_damage}</span>`;
		c6.innerHTML = `<span class="fast">${v.fast_stamina_required}</span><span class="strong">${v.strong_stamina_required}</span>`;
		c7.innerHTML = v.throw_damage;
		c8.innerHTML = v.throw_hs_damage;
		c9.innerHTML = v.price;
		c10.innerHTML = v.kill_award;
		c11.innerHTML = v.weight.toFixed(2);
	});
	const el = document.querySelector("#melees > thead > tr > th:nth-child(9)");
	if (el) {
		el.click();
		el.click();
	}
}

function parse_explosives(json) {
	var table = document.getElementById("explosives").getElementsByTagName("tbody")[0];
	Object.entries(json).forEach(([k, v]) => {
		var row = table.insertRow(-1);
		var c1 = row.insertCell(0);
		var c2 = row.insertCell(1);
		var c3 = row.insertCell(2);
		var c4 = row.insertCell(3);
		var c5 = row.insertCell(4);
		var c6 = row.insertCell(5);
		var c7 = row.insertCell(6);
		var c8 = row.insertCell(7);
		c1.innerHTML = v.display_name;
		c2.innerHTML = `<img src="https://raw.githubusercontent.com/TeamHypersomnia/Hypersomnia/master/hypersomnia/content/gfx/${v.pic_filename}">`;
		c3.innerHTML = v.notes;
		c4.innerHTML = v.fuse_delay.toFixed(2);
		if (v.base_damage <= 0) {
			v.base_damage = "N/A";
		}
		c5.innerHTML = v.base_damage;
		if (v.price <= 0) {
			v.price = "N/A";
		}
		c6.innerHTML = v.price;
		if (v.kill_award <= 0) {
			v.kill_award = "N/A";
		}
		c7.innerHTML = v.kill_award;
		c8.innerHTML = v.weight.toFixed(2);
	});
	const el = document.querySelector("#explosives > thead > tr > th:nth-child(6)");
	if (el) {
		el.click();
		el.click();
	}
}

function parse_spells(json) {
	var table = document.getElementById("spells").getElementsByTagName("tbody")[0];
	Object.entries(json).forEach(([k, v]) => {
		var row = table.insertRow(-1);
		var c1 = row.insertCell(0);
		var c2 = row.insertCell(1);
		var c3 = row.insertCell(2);
		var c4 = row.insertCell(3);
		var c5 = row.insertCell(4);
		var c6 = row.insertCell(5);
		var c7 = row.insertCell(6);
		c1.innerHTML = v.display_name;
		c2.innerHTML = `<img class="notes" title="${v.incantation}" src="https://raw.githubusercontent.com/TeamHypersomnia/Hypersomnia/master/hypersomnia/content/gfx/${v.pic_filename}">`;
		c3.innerHTML = v.notes;
		c4.innerHTML = v.cooldown;
		c5.innerHTML = v.mana_required;
		c6.innerHTML = v.price;
		if (v.kill_award <= 0) {
			v.kill_award = "N/A";
		}
		c7.innerHTML = v.kill_award;
	});
	const el = document.querySelector("#spells > thead > tr > th:nth-child(6)");
	if (el) {
		el.click();
		el.click();
	}
}

function loadwpns() {
	var raw = new XMLHttpRequest();
	raw.open("GET", "./all_firearms.json", false);
	raw.onreadystatechange = function() {
		if (raw.readyState === 4) {
			if (raw.status === 200 || raw.status == 0) {
				parse_firearms(JSON.parse(raw.responseText));
			}
		}
	}
	raw.send(null);
	var raw = new XMLHttpRequest();
	raw.open("GET", "./all_melees.json", false);
	raw.onreadystatechange = function() {
		if (raw.readyState === 4) {
			if (raw.status === 200 || raw.status == 0) {
				parse_meeles(JSON.parse(raw.responseText));
			}
		}
	}
	raw.send(null);
	var raw = new XMLHttpRequest();
	raw.open("GET", "./all_explosives.json", false);
	raw.onreadystatechange = function() {
		if (raw.readyState === 4) {
			if (raw.status === 200 || raw.status == 0) {
				parse_explosives(JSON.parse(raw.responseText));
			}
		}
	}
	raw.send(null);
	var raw = new XMLHttpRequest();
	raw.open("GET", "./all_spells.json", false);
	raw.onreadystatechange = function() {
		if (raw.readyState === 4) {
			if (raw.status === 200 || raw.status == 0) {
				parse_spells(JSON.parse(raw.responseText));
			}
		}
	}
	raw.send(null);
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
