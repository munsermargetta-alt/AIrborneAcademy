"""
extraer_rutas_seneam.py — Convierte el "Manual de apoyo con rutas para el FPL" (PDF oficial de SENEAM/AFAC,
https://www.gob.mx/cms/uploads/attachment/file/602702/manual-de-apoyo-con-rutas-para-el-fpl.pdf)
en el archivo de datos de la app: web/sitio/app/rutas_seneam.js

Uso:  pdftotext -layout manual.pdf manual.txt
      python3 extraer_rutas_seneam.py manual.txt ../web/sitio/app/rutas_seneam.js

Cada renglón del manual tiene: aeródromo de salida, código OACI, ciudad, estado, ruta y destinatarios AFTN.
El nombre del aeropuerto viene partido en el renglón de arriba y el de abajo; aquí se vuelve a juntar.
"""
import re, json, sys, collections

entrada, salida = sys.argv[1], sys.argv[2]
L = open(entrada, encoding='utf-8').read().split('\n')
cod = re.compile(r'\b(MM[A-Z0-9]{2})\s{2,}')                                  # código OACI de México
ruta_rx = re.compile(r'([A-Z]{2,3})\s+([A-Z]{1,2}\d{1,3}[A-Z]?)\s*([A-Z]{3,5})$')  # VOR + aerovía + punto (de 3 a 5 letras)
es_fila = lambda l: bool(cod.search(l)) and re.search(r'[A-Z]{8}\s*$', l.rstrip()) is not None

A = collections.OrderedDict()
for i, l in enumerate(L):
    if not es_fila(l):
        continue
    l = l.rstrip(); m = cod.search(l); resto = l[m.end():]
    dm = re.search(r'((?:[A-Z]{8}\s*)+)$', resto)            # destinatarios: grupos de 8 letras al final
    cuerpo = resto[:dm.start()].rstrip()
    rm = ruta_rx.search(cuerpo)
    arriba = L[i - 1].strip() if i > 0 and not es_fila(L[i - 1]) else ''
    abajo = L[i + 1].strip() if i + 1 < len(L) and not es_fila(L[i + 1]) else ''
    nombre = re.sub(r'\s+', ' ', ' '.join(x for x in [arriba, l[:m.start()].strip(), abajo] if x))
    a = A.setdefault(m.group(1), {'n': nombre, 'l': re.sub(r'\s+', ' ', cuerpo[:rm.start()] if rm else cuerpo).strip(), 'd': [], 'r': []})
    for x in dm.group(1).split():
        if x not in a['d']:
            a['d'].append(x)
    if rm:                                                    # renglones sin ruta (vacíos en el manual) se ignoran
        r = f'{rm.group(1)} {rm.group(2)} {rm.group(3)}'
        if r not in a['r']:
            a['r'].append(r)

with open(salida, 'w', encoding='utf-8') as f:
    f.write('/* Datos extraídos del "Manual de apoyo con rutas para el FPL" (SENEAM/AFAC, publicado en gob.mx; archivo de 2012).\n'
            ' * Por aeródromo de salida: n = nombre, l = ciudad y estado, d = destinatarios AFTN, r = rutas de salida (VOR, aerovía, punto).\n'
            ' * Generado con herramientas/extraer_rutas_seneam.py. NO editar a mano. */\n')
    f.write('window.AIrRutasSENEAM = ' + json.dumps(A, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(A), 'aeródromos,', sum(len(v['r']) for v in A.values()), 'rutas')
