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

function parsewpns(json) {
	var table = document.getElementById("weapons").getElementsByTagName("tbody")[0];
	Object.entries(json).forEach(([k, v]) => {
		console.log(`${k} ${v}`);
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
		c2.innerHTML = `<img src="https://raw.githubusercontent.com/TeamHypersomnia/Hypersomnia/master/hypersomnia/content/gfx/${v.id}.png">`;
		c3.innerHTML = v.damage;
		c4.innerHTML = v.headshot_damage;
		c5.innerHTML = v.shots_per_second.toFixed(2);
		c6.innerHTML = average(v.min_bullet_speed, v.max_bullet_speed);
		c7.innerHTML = v.price;
		c8.innerHTML = v.kill_award;
	});
	const el = document.querySelector("#weapons > thead > tr > th:nth-child(7)");
	if (el) {
		el.click();
		el.click();
	}
}

function loadwpns() {
	var raw = new XMLHttpRequest();
	raw.open("GET", "./all_weapons.json", false);
	raw.onreadystatechange = function() {
		if (raw.readyState === 4) {
			if (raw.status === 200 || raw.status == 0) {
				parsewpns(JSON.parse(raw.responseText));
			}
		}
	}
	raw.send(null);
}
