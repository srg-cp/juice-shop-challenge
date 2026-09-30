# Juice Shop Solver

Servicio web para intentar resolver retos en una instancia propia de OWASP Juice Shop. Acepta una URL base HTTP o HTTPS, incluidos dominios y direcciones IP con puerto. Permite pedir entre 1 y 35 **retos nuevos**. Consulta `/api/Challenges` después de cada intento y solo cuenta los retos que la instancia confirma como resueltos.

## Despliegue en Dokploy

1. Sube este repositorio a GitHub y crea un proyecto de tipo **Docker Compose** en Dokploy apuntando al repositorio.
2. Configura `API_TOKEN` con un secreto aleatorio de al menos 24 caracteres. Opcionalmente, configura `ALLOWED_TARGETS` con orígenes exactos separados por comas, por ejemplo `https://juice.kormind.com,http://192.30.108.73:3001`.
3. En la pestaña **Domains** del servicio Compose, agrega tu subdominio con HTTPS y selecciona el servicio `solver` y puerto interno `3000`. El Compose no ocupa el puerto `3000` del VPS.
4. Introduce el mismo token, la URL raíz de Juice Shop y la cantidad deseada.

Si el objetivo usa una IP privada o HTTP, el contenedor de Dokploy debe poder acceder a esa dirección desde su red. Usa `ALLOWED_TARGETS` cuando el servicio quede expuesto a Internet; el token impide que visitantes sin autorización inicien ejecuciones.

## API

```http
POST /api/runs
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{"url":"https://juice.kormind.com/","count":35}
```

La respuesta `202` contiene un `id`. Consulta `GET /api/runs/<id>` con el mismo encabezado para ver el progreso. Solo se permite una ejecución simultánea. `GET /health` sirve para la comprobación de salud.

## Alcance

El motor incluye más de 35 intentos basados en los retos documentados para Juice Shop v20.2.0. Algunos retos requieren navegador, credenciales estándar o características que una instancia concreta puede tener desactivadas. Si no alcanza la meta, el estado será `partial` y la respuesta mostrará cuántos retos quedaron confirmados y los intentos fallidos. Un intento puede resolver varios retos relacionados, por lo que el resultado puede superar ligeramente la cantidad solicitada. La aplicación guarda los informes en memoria; se pierden al reiniciar el contenedor.

Referencias: [API de retos](https://pwning.owasp-juice.shop/companion-guide/latest/part4/integration.html) y [soluciones de Juice Shop v20.2.0](https://pwning.owasp-juice.shop/companion-guide/snapshot/appendix/solutions.html).

## Desarrollo

`npm test` ejecuta las pruebas del motor. El contenedor incluye Chromium mediante la imagen oficial de Playwright.
