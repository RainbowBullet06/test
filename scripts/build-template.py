"""
Convierte 'formato y ejemplo evaluacion.docx' en la plantilla src/assets/plantilla-informe.docx
reemplazando el texto de ejemplo por marcadores {campo} de docxtemplater.
Todo el formato (estilos, cuadros de texto, numeración, márgenes) se conserva intacto.

Uso:  python scripts/build-template.py
"""
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "formato y ejemplo evaluacion.docx"
DST = ROOT / "src" / "assets" / "plantilla-informe.docx"

with zipfile.ZipFile(SRC) as z:
    files = {n: z.read(n) for n in z.namelist()}

xml = files["word/document.xml"].decode("utf8")

BOLD = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/></w:rPr>'
PLAIN = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/></w:rPr>'


def run(text, rpr):
    return f'<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r>'


def text_of(p):
    return "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p))


def ppr_of(p):
    m = re.search(r"<w:pPr>.*?</w:pPr>", p, flags=re.S)
    return m.group(0) if m else ""


def longest_rpr(p):
    runs = re.findall(r"<w:r(?: [^>]*)?>(.*?)</w:r>", p, flags=re.S)
    best, best_len = PLAIN, -1
    for r in runs:
        rpr = re.search(r"<w:rPr>.*?</w:rPr>", r, flags=re.S)
        t = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", r))
        if rpr and len(t) > best_len:
            best, best_len = rpr.group(0), len(t)
    return best


def rebuild(p, body):
    open_tag = re.match(r"<w:p(?: [^>]*)?>", p).group(0)
    return open_tag + ppr_of(p) + body + "</w:p>"


# Paragraph replacements keyed by the start of the example text
CONTENT = [
    ("En exploración de aparato fonoarticulador", "{fonoarticulador}"),
    ("En la narración y descripción", "{pragmatico}"),
    ("Comprende ordenes sencillas", "{semantico}"),
    ("En la estructura gramatical", "{morfosintactico}"),
    ("No presenta trastornos fonológicos", "{fonologico}"),
    (" En suprasegmentos de voz", "{suprasegmentos}"),
    ("La alumna presenta dificultad", "{conclusion}"),
]

pattern = re.compile(r"<w:p [^>]*>(?:(?!<w:p ).)*?</w:p>", flags=re.S)
done = set()


def replace(m):
    p = m.group(0)
    if "<w:txbxContent>" in p or "<mc:AlternateContent>" in p:
        return p
    t = text_of(p)
    if t.startswith("Nombre del alumno"):
        done.add("nombre")
        return rebuild(p, run("Nombre del alumno(a): ", BOLD) + run("{nombre}", PLAIN)
                       + run("          Edad: ", BOLD) + run("{edad}", PLAIN))
    if t.startswith("Escuela:"):
        done.add("escuela")
        return rebuild(p, run("Escuela: ", BOLD) + run("{escuela}", PLAIN)
                       + run("          Grado y sección: ", BOLD) + run("{grado}", PLAIN))
    if t.startswith("Lugar y fecha de aplicación"):
        done.add("lugar")
        return rebuild(p, run("Lugar y fecha de aplicación: ", BOLD) + run("{lugar_fecha}", PLAIN))
    if t.startswith("Instrumento de evaluación aplicado"):
        done.add("instrumento")
        return rebuild(p, run("Instrumento de evaluación aplicado: ", BOLD) + run("{instrumento}", PLAIN))
    for prefix, tag in CONTENT:
        if t.startswith(prefix):
            done.add(tag)
            # el ejemplo del pragmático venía centrado; se justifica como el resto
            return rebuild(p.replace('<w:jc w:val="center"/>', '<w:jc w:val="both"/>'), run(tag, longest_rpr(p)))
    return p


xml = pattern.sub(replace, xml)
# ciclo escolar en el encabezado (aparece en Choice y Fallback del cuadro de texto)
xml = xml.replace("<w:t>2026-2027</w:t>", "<w:t>{ciclo}</w:t>")

expected = {"nombre", "escuela", "lugar", "instrumento", *[t for _, t in CONTENT]}
missing = expected - done
if missing:
    raise SystemExit(f"No se encontraron: {missing}")

# nombres de quienes firman, en una línea bajo las rayas de firma
sig = re.search(r'(<w:p [^>]*>(?:(?!<w:p ).)*?___________________________________(?:(?!<w:p ).)*?</w:p>)', xml, flags=re.S)
if sig:
    # tabulaciones centradas bajo cada raya de firma (ancho útil 9639 twips)
    names = ('<w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="2485"/><w:tab w:val="center" w:pos="7210"/></w:tabs>'
             '<w:spacing w:after="0"/></w:pPr>'
             f'<w:r>{PLAIN}<w:tab/></w:r>{run("{firma_especialista}", PLAIN)}'
             f'<w:r>{PLAIN}<w:tab/></w:r>{run("{firma_docente}", PLAIN)}</w:p>')
    xml = xml.replace(sig.group(1), sig.group(1) + names, 1)

files["word/document.xml"] = xml.encode("utf8")
DST.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as z:
    for n, data in files.items():
        z.writestr(n, data)
print("Plantilla creada:", DST, "campos:", sorted(done))
