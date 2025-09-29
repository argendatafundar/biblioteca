from pathlib import Path
import json
import requests
import csv
import io
import re

ROOT = Path(__file__).parent.resolve()
GRAFICOS = ROOT / "graficos"
MANIFEST = ROOT / "manifest.json"

NOMBRES_TOPICOS = {
    'ACECON': 'Crecimiento',
    'AGROPE': 'Agroindustria',
    'CAMCLI': 'Cambio climático y Emisiones de gas a efecto invernadero',
    'CIETEC': 'Ciencia y Tecnología',
    'COMEXT': 'Comercio exterior',
    'CRECIM': 'Crecimiento',
    'DEMOGR': 'Población',
    'DESHUM': 'Desarrollo humano',
    'DESIGU': 'Desigualdad',
    'ESTPRO': 'Estructura productiva',
    'FISCAL': 'Gasto público',
    'INFDES': 'Informalidad y desempleo',
    'MERTRA': 'Trabajo y participación laboral',
    'MINERI': 'Minería',
    'PESCAS': 'Pesca y acuicultura',
    'POBREZ': 'Pobreza',
    'PRECIO': 'Inflación',
    'SALING': 'Salarios e ingresos',
    'SEBACO': 'Servicios basados en el conocimiento',
    'TRANEN': 'Transición energética'
}

def remove_prefix(text, prefix):
    if isinstance(text, str) and text.startswith(prefix):
        return text[len(prefix):].lstrip()
    return text

def get_content(owner: str, repo: str, path: str) -> dict:
    """
    equivalent to:
    curl -L \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer <YOUR-TOKEN>" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/OWNER/REPO/contents/PATH
    """
    
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/refs/heads/main/{path}"


    # print(f"Fetching content from {url}")

    response = requests.get(url)
    if response.status_code == 200:
        return response
    else:
        raise Exception(f"Error: {response.status_code} - {response.text}")


def get_mapping_json(topico):
    response = get_content("argendatafundar", "transformers", f"{topico}/mappings.json")
    data = response.json()
    result = {}
    for k,v in data.items():
        for item in v:
            result[item['public']] = k
    return result

def get_mapping_csv(topico):
    
    content = get_content("argendatafundar", "transformers", f"{topico}/mappings.csv")
    csv_content = content.text
    reader = csv.DictReader(io.StringIO(csv_content))
    return {f"{topico}_g{str(row['id_grafico']).zfill(2)}": row['nombre_archivo'] for row in reader}

def get_mapping(topico):
    try:
        return get_mapping_json(topico)
    except Exception as e_json:
        print(f"[get_mapping] Falla JSON para tópico {topico}: {e_json}. Intentando CSV...")
        try:
            return get_mapping_csv(topico)
        except Exception as e_csv:
            print(f"[get_mapping] ERROR: no se pudo obtener mapping para tópico {topico}. CSV también falló: {e_csv}")
            raise

def get_topico_name(s):
    for topico, nombre in NOMBRES_TOPICOS.items():
        if re.match(topico, s):
            return topico,nombre
    return None, None


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
            if "id_grafico" in r and r["id_grafico"] is not None:
                print(r["id_grafico"])
                topico, nombre_topico = get_topico_name(r["id_grafico"])
                if topico is None:
                    continue
                r['topico'] = topico
                id_grafico = r["id_grafico"]
                r['nombre_topico'] = nombre_topico
                mapping = get_mapping(topico)
                r["nombre_archivo"] = mapping[id_grafico]
                r["link_dataset"] = f"https://raw.githubusercontent.com/argendatafundar/data/refs/heads/main/{topico}/{r['nombre_archivo']}"
            if "__source" not in r:
                r["__source"] = rel
            # Limpieza de prefijos
            if "fuente" in r:
                r["fuente"] = remove_prefix(r["fuente"], "Fuente de datos: ")
            if "nota" in r:
                r["nota"] = remove_prefix(r["nota"], "Nota: ")
            
            items.append(r)
        


    MANIFEST.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Escrito {MANIFEST} con {len(items)} registros desde {GRAFICOS}")

if __name__ == "__main__":
    main()