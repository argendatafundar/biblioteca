from pathlib import Path
import json

ROOT = Path(__file__).parent.resolve()
GRAFICOS = ROOT / "graficos"
MANIFEST = ROOT / "manifest.json"

def normalize_item(x):
    if isinstance(x, dict):
        return x
    return {"value": x}

def read_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"__error": str(e)}

def main():
    if not GRAFICOS.exists():
        print("Directorio 'graficos' no existe. No se generará manifest.")
        return

    items = []
    for p in sorted(GRAFICOS.rglob("*.json")):
        if p.name.lower() == "manifest.json":
            continue
        rel = p.relative_to(ROOT).as_posix()
        data = read_json(p)

        # Normalización a lista de registros
        if isinstance(data, list):
            rows = [normalize_item(x) for x in data]
        elif isinstance(data, dict):
            if isinstance(data.get("items"), list):
                rows = [normalize_item(x) for x in data["items"]]
            else:
                rows = [normalize_item(data)]
        else:
            rows = [normalize_item(data)]

        for r in rows:
            if "__source" not in r:
                r["__source"] = rel
            items.append(r)

    MANIFEST.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Escrito {MANIFEST} con {len(items)} registros desde {GRAFICOS}")

if __name__ == "__main__":
    main()