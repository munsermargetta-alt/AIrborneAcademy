# Intermediario de METAR y TAF (Cloudflare Workers)

**Para qué sirve:** aviationweather.gov (NOAA) no deja que una página web lea sus datos directamente. Este programa corre gratis en Cloudflare: la app le pide `?ids=MMTO`, él consulta a la NOAA y le devuelve el METAR y el TAF con permiso para el navegador. Guarda cada respuesta 5 minutos. Así la NOAA recibe muy pocas consultas (su límite es 100 por minuto).

**Cuenta:** ábrela con la **cuenta de la marca** (contacto@airborneacademy.app). Es infraestructura de AIrborne y en el futuro puede alojar más servicios, como el muro de pago. El plan gratuito incluye 100,000 consultas al día y no pide tarjeta.

## Publicarlo (unos 10 minutos, sin instalar nada)

1. Entra a https://dash.cloudflare.com/sign-up y crea la cuenta con contacto@airborneacademy.app. **La contraseña la escribes tú.**
2. En el menú, ve a **Compute (Workers) → Workers & Pages → Create → Start with Hello World**.
3. Nómbralo `airborne-meteo` y pulsa **Deploy**.
4. Pulsa **Edit code**. Borra todo y pega el contenido completo de `worker.js`. Pulsa **Deploy**.
5. Copia la dirección que te da. Se ve así: `https://airborne-meteo.TU-SUBDOMINIO.workers.dev`.
6. Para probarlo, abre en el navegador `https://airborne-meteo.TU-SUBDOMINIO.workers.dev/?ids=MMTO`. Debe mostrar el METAR y el TAF de Toluca.
7. Pásame la dirección. La pongo en `meteo.js` (`SERVICIO_PUBLICADO`) y desde ese momento el botón **Traer** de la app funciona para todos.

## Pruebas sin internet

`node prueba_worker.mjs` simula la NOAA y la caché, y revisa las validaciones, la caché y el permiso CORS.
