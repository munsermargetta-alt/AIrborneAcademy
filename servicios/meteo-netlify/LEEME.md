# Intermediario de METAR y TAF (Netlify)

La página de AIrborne Academy vive en GitHub Pages. Este folder es **solo** el intermediario que trae METAR y TAF de aviationweather.gov (NOAA), porque la NOAA no deja que una página web lea sus datos directamente.

- Proyecto de Netlify: `airborne-meteo` (cuenta contacto@airborneacademy.app).
- Dirección: `https://airborne-meteo.netlify.app/meteo?ids=MMTO`
- Código: `netlify/functions/meteo.mjs` (comentado). Prueba sin internet: `node prueba.mjs`.

## Conectar el proyecto con GitHub (una sola vez)

1. Entra a https://app.netlify.com/projects/airborne-meteo
2. Ve a **Project configuration → Build & deploy → Continuous deployment → Link repository**.
3. Elige **GitHub** y el repositorio `munsermargetta-alt/airborneacademy`, rama `main`.
4. Configura **Base directory** = `servicios/meteo-netlify`. Deja vacíos el comando de build y los demás campos: los toma de `netlify.toml`.
5. Pulsa **Deploy**.

Desde entonces, cada cambio que se suba a GitHub en este folder se publica solo.
