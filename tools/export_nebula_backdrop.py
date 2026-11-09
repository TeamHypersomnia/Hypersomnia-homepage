#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path

from PIL import Image

CONST_MULT = 100
LINEAR_MULT = 10000
QUADRATIC_MULT = 10000000

SITE_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = SITE_ROOT / "public" / "assets" / "images" / "nebula_backdrop"


def calc_core(falloff):
    return 0.08 ** min(max(falloff, 0.0), 1.0)


def mix_terms(t):
    return [max(0.0, 1.0 - 2.0 * t), 1.0 - abs(2.0 * t - 1.0), max(0.0, 2.0 * t - 1.0)]


def fit_legacy_attenuation_like_game(radius, intensity, falloff, alpha):
    num_samples = 24
    num_mixes = 21
    num_strengths = 40

    core = calc_core(falloff)
    xs = []
    target = []

    for i in range(num_samples):
        x = (i + 0.5) / num_samples
        core_x = x / core
        window = min(max(1.0 - x ** 4, 0.0), 1.0)
        xs.append(x)
        target.append(min(1.0, alpha * intensity * window * window / (1.0 + core_x * core_x)))

    best_error = float("inf")
    best_terms = mix_terms(0.5)
    best_strength = 30.0

    for m in range(num_mixes):
        terms = mix_terms(m / (num_mixes - 1))
        edge = sum(terms)

        for k in range(num_strengths):
            strength = round(255.0 ** (k / (num_strengths - 1)))
            cutoff_x = max(0.0, 1.0 - 3.0 * strength / radius)
            error = 0.0

            for x, wanted in zip(xs, target):
                atten = terms[0] + terms[1] * x + terms[2] * x * x
                legacy = (strength / 255.0) * edge / atten if atten > 0.0 else 1.0

                if x > cutoff_x:
                    u = (x - cutoff_x) / (1.0 - cutoff_x)
                    legacy *= 0.5 * (1.0 - u * u)

                diff = min(alpha, legacy) - wanted
                error += diff * diff * x

            if error < best_error:
                best_error = error
                best_terms = terms
                best_strength = strength

    edge = sum(best_terms)
    mult = 255.0 / (edge * best_strength)

    return {
        "constant": best_terms[0] * mult,
        "linear": best_terms[1] / radius * mult,
        "quadratic": best_terms[2] / (radius * radius) * mult,
        "trim_alpha": int(best_strength),
    }


def calc_reach_like_game(attenuation):
    epsilon = 0.0000000001
    a = max(attenuation["constant"], epsilon)
    b = max(attenuation["linear"], epsilon)
    c = max(attenuation["quadratic"], epsilon)
    d = max(max(1, attenuation["trim_alpha"]), epsilon)

    return (c * math.sqrt((-4 * a * c * d + b * b * d + 1020 * c) / c / c / d) - b) / 2 / c


def export_light(node):
    color = node.get("color", [255, 255, 255, 255])
    falloff = node.get("falloff", {})
    radius = falloff.get("radius", 600.0)
    attenuation = fit_legacy_attenuation_like_game(
        radius,
        falloff.get("intensity", 1.0),
        falloff.get("falloff", 0.5),
        color[3] / 255.0,
    )
    max_distance = calc_reach_like_game(attenuation)
    vibration = node.get("intensity_vibration", 0.1)

    return {
        "pos": node["pos"],
        "color": [channel / 255.0 for channel in color],
        "attenuation": [attenuation["constant"], attenuation["linear"], attenuation["quadratic"]],
        "max_distance": max_distance,
        "cutoff_distance": max(0.0, max_distance - 3 * attenuation["trim_alpha"]),
        "vibration": vibration,
    }


def export_texture_as_lossless_webp(source, name):
    output = OUTPUT_DIR / f"{name}.webp"
    Image.open(source).convert("RGBA").save(output, lossless=True, quality=100, method=6, exact=True)

    return output.name


def export_layer(node, resource, map_dir):
    tile_size = resource.get("size", [1024, 1024])

    return {
        "texture": export_texture_as_lossless_webp(map_dir / resource["path"], node["id"]),
        "pos": node["pos"],
        "tile_size": tile_size,
        "color": [channel / 255.0 for channel in resource.get("color", [255, 255, 255, 255])],
        "degrees_per_sec": resource.get("rotate_continuously_degrees_per_sec", 0.0),
    }


def main():
    map_dir = Path(sys.argv[1])
    camera_pos = [float(coordinate) for coordinate in sys.argv[2].split(",")]

    project = json.loads((map_dir / f"{map_dir.name}.json").read_text())
    nodes_by_id = {node["id"]: node for node in project["nodes"]}
    resources_by_id = {resource["id"]: resource for resource in project["external_resources"]}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    layers = []
    lights = []

    for layer in reversed(project["layers"]):
        for node_id in reversed(layer["nodes"]):
            node = nodes_by_id[node_id]
            node_type = node["type"]

            if node_type == "point_light":
                lights.append(export_light(node))
            elif node_type in resources_by_id:
                layers.append(export_layer(node, resources_by_id[node_type], map_dir))

    settings = project["settings"]

    backdrop = {
        "camera": camera_pos,
        "ambient": [channel / 255.0 for channel in settings["ambient_light_color"]],
        "layers": layers,
        "lights": lights,
    }

    (OUTPUT_DIR / "backdrop.json").write_text(json.dumps(backdrop, separators=(",", ":")))

    print(f"{len(layers)} layers, {len(lights)} lights, camera at {camera_pos}")


if __name__ == "__main__":
    main()
