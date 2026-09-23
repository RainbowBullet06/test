# Evaluaciones de Comunicación

Aplicación para que la especialista en comunicación (USAER / CAM) registre escuelas y alumnos, aplique la
**Evaluación de Comunicación Verbal** desde la PC o el celular y genere el **Informe de Comunicación Verbal y
No Verbal** en Word con el mismo formato oficial.

Opcionalmente, la app genera instrucciones **sin datos personales** para pegarlas en ChatGPT, Claude o Gemini;
la respuesta se muestra como sugerencia en cada sección y la especialista decide el texto final.

## Flujo

1. **Escuelas** → dar de alta la escuela (tipo USAER/CAM, turno, CCT).
2. **Alumnos** → nombre, sexo, fecha de nacimiento o edad, grado, grupo y maestro(a) de grupo.
3. **Evaluar** → asistente de 7 pasos con autoguardado, igual que la prueba en papel:
   datos, aparato fonoarticulador y respiración, voz y discriminación auditiva, pragmático y morfosintaxis,
   semántico, fonológico (55 palabras con O/S/D por posición) y conclusiones.
4. **Informe** →
   - *Borrador automático*: redacción sencilla a partir de los datos (sin IA).
   - *Redacción asistida* (opcional): "Copiar instrucciones" → pegarlas en ChatGPT/Claude/Gemini → pegar la respuesta → aparecen sugerencias.
   - Cada sección tiene **Aceptar**, **Agregar al final** o edición libre.
   - **Descargar Word (.docx)** con el formato de `formato y ejemplo evaluacion.docx`.

## Configuración inicial

La primera vez que se abre, la app pide el nombre del maestro(a) y, en la computadora, la **carpeta de
respaldo** (se sugiere `Documentos\Evaluaciones de Comunicación`; puede ser una USB o una carpeta de Drive/OneDrive).

## Respaldo en archivos (computadora)

Cada cambio se guarda automáticamente en la carpeta elegida, además de la base de datos:

```
Evaluaciones de Comunicación/
├── respaldo-completo.json                 ← todo, para restaurar
├── respaldos/respaldo-AAAA-MM-DD.json     ← una copia por día (últimos 60)
└── Evaluaciones/<Escuela>/<Alumno>/
    ├── AAAA-MM-DD - Evaluación (xxxxxx).json
    └── AAAA-MM-DD - Informe (xxxxxx).docx  ← cada informe descargado
```

Si la computadora falla: se reinstala la app, se elige la misma carpeta y la app ofrece **Restaurar mis datos**.
Un equipo recién instalado nunca sobrescribe un respaldo que tiene datos.

## Celular: instalar, actualizar y sincronizar

- La app del celular se publica **gratis** como página estática HTTPS (GitHub Pages). Ahí solo va el
  programa; **ningún dato** de alumnos pasa por internet.
- **Instalar:** en la computadora, *Celular* → escanear el QR "Instalar la app en el celular".
- **Actualizar:** automático; cuando hay versión nueva aparece el aviso "Actualizar".
- **Sincronizar (en casa):** en la computadora *Celular* → **Conectar celular (solo en casa)**. Se enciende
  un servidor local temporal (se apaga solo a los 15 min o con *Desconectar*) y aparece un QR con un código
  secreto de un solo uso. En el celular: abrir la cámara y apuntar al QR (o *Escanear código de la
  computadora* dentro de la app). Los datos se juntan en ambos sentidos; en cada registro gana el cambio más
  reciente. Nunca se enciende nada en la escuela si no se presiona el botón.
- Cómo se evita el bloqueo del navegador (página HTTPS → PC por HTTP): primero se usa el permiso de Chrome
  de *acceso a la red local*; si el navegador no lo permite, la sincronización pasa por una página puente de
  la PC (navegación directa, que sí está permitida) y regresa a la app.
- **Sin Wi-Fi:** *Pasar datos con un archivo* (WhatsApp, correo, Quick Share); los datos se juntan, no se reemplazan.
- La primera vez, Windows preguntará si permite a la app usar la red: elegir **Permitir** (red privada).

### Publicar la app para celulares (una vez)

1. Crear un repositorio en GitHub y subir este proyecto.
2. En el repositorio: *Settings → Pages → Source: GitHub Actions*. El flujo `.github/workflows/pages.yml`
   compila y publica automáticamente en cada cambio.
3. Copiar la dirección publicada (ej. `https://usuario.github.io/evaluaciones-comunicacion/`) en la app de
   escritorio: *Ajustes → App para celulares* (o compilar con `VITE_APP_URL`).

## Privacidad

- Todo se guarda **solo en los equipos** de la maestra (IndexedDB + carpeta de respaldo). No hay servidor en la nube.
- El prompt para la IA no incluye nombre, escuela ni nombres de maestros. Además, cualquier aparición de esos
  nombres en el texto libre (muestra oral, observaciones, respuestas) se reemplaza por `[NOMBRE]`.
  Con "Ver qué se envía" se puede revisar el texto exacto antes de copiarlo.
- **Ajustes → Copia en archivo** descarga un `.json` con todo (para una USB, por ejemplo).

## Desarrollo

Requiere Node 20+.

```bash
npm install
npm run dev          # navegador en http://localhost:5173
npm run electron     # compila y abre la app de escritorio
npm run dist         # instalador de Windows en /release
```

## Plantilla del informe

`src/assets/plantilla-informe.docx` se genera a partir del documento original con:

```bash
python scripts/build-template.py
```

El script reemplaza el texto de ejemplo por marcadores (`{nombre}`, `{pragmatico}`, …) y conserva intactos
estilos, encabezado, numeración y márgenes. Si cambia el formato oficial, basta con reemplazar
`formato y ejemplo evaluacion.docx` y volver a ejecutar el script.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/data/formato.ts` | Estructura de la prueba (órganos, voz, 55 fonemas, referentes, secciones del informe) |
| `src/db.ts` | Base de datos local (Dexie/IndexedDB) con identificadores globales y registro de borrados |
| `src/lib/sync.ts` | Paquete de datos, fusión PC↔celular y conexión con la computadora |
| `src/lib/respaldo.ts` | Respaldo automático en archivos (escritorio) |
| `src/lib/analisis.ts` | Resumen de resultados y borradores automáticos |
| `src/lib/prompt.ts` | Prompt anónimo para la IA y lectura tolerante de su respuesta |
| `src/lib/docx.ts` | Generación del Word con docxtemplater |
| `src/pages/` | Pantallas (inicio, escuelas, alumnos, asistente, informe, ajustes) |
| `electron/main.cjs` | Ventana, carpeta de respaldo y servidor local bajo demanda |
| `electron/preload.cjs` | Puente seguro entre la ventana y el sistema |
