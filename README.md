# Juice Shop Solver

Servicio web para intentar resolver retos en una instancia propia de OWASP Juice Shop. Acepta una URL base HTTP o HTTPS, incluidos dominios y direcciones IP con puerto. Permite elegir cuántos **retos nuevos** intentar de cada nivel de 1 a 6 estrellas, con un máximo de 40 en total y 8 del nivel 3. Consulta `/api/Challenges` después de cada intento y solo cuenta los retos que la instancia confirma como resueltos.

Para Juice Shop v20.2.0 hay intentos para los **13 retos de nivel 1 y los 19 de nivel 2**. El botón **Seleccionar niveles 1 y 2 completos** elige todos los pendientes con intento de esos niveles y pone los demás en cero. Juice Shop puede deshabilitar retos según el entorno; esos retos se muestran aparte y no se intentan. Los retos **AI Debugging** y **Chatbot Prompt Injection** requieren que la propia instancia de Juice Shop tenga funcionando su proveedor de IA. Si el chatbot devuelve un error de conexión, el informe lo indica y la ejecución queda parcial. [Guía oficial de configuración del chatbot](https://pwning.owasp-juice.shop/companion-guide/local/part1/running.html).

## Programa portátil para Windows

En GitHub, abre **Actions → Windows portable → la ejecución más reciente → Artifacts** y descarga `Juice-Shop-Solver-Windows-portable`. Descomprime el archivo y copia `Juice-Shop-Solver-*-portable.exe` a la PC del laboratorio. También puedes compilarlo en Windows con `npm ci` y `npm run build:win`. El `.exe` se ejecuta sin Docker, Node ni instalación. Al abrirlo, inicia la interfaz en `http://127.0.0.1:4173/` y abre esa página en el navegador predeterminado. Si `4173` ya está ocupado, elige otro puerto libre y abre la dirección correcta automáticamente. Pega la URL de Juice Shop asignada, por ejemplo `http://172.30.108.61:3000/`, consulta los retos disponibles y elige la cantidad por nivel.

Las solicitudes salen de esa misma PC, por lo que debe tener acceso a la red del laboratorio. La aplicación usa Microsoft Edge instalado para los retos que requieren navegador. El servicio interno escucha solo en `127.0.0.1` y crea un token al iniciar. El icono de la bandeja de Windows permite volver a abrir la página o elegir **Salir** para detener el servicio. Si Edge no está disponible o la política de la PC impide automatizarlo, los retos que lo requieren pueden fallar, mientras que los intentos por HTTP siguen disponibles.

Para desarrollar localmente: `npm ci` y `npm run desktop`. El archivo final queda en `dist/`. Al tratarse de un ejecutable sin firma, Windows puede mostrar una advertencia de SmartScreen.

## Despliegue en Dokploy

1. Sube este repositorio a GitHub y crea un proyecto de tipo **Docker Compose** en Dokploy apuntando al repositorio.
2. Configura `API_TOKEN` con un secreto aleatorio de al menos 24 caracteres. Opcionalmente, configura `ALLOWED_TARGETS` con orígenes exactos separados por comas, por ejemplo `https://juice.kormind.com,http://192.30.108.73:3001`.
3. En la pestaña **Domains** del servicio Compose, agrega tu subdominio con HTTPS y selecciona el servicio `solver` y puerto interno `3000`. El Compose no ocupa el puerto `3000` del VPS.
4. Introduce el mismo token y la URL raíz de Juice Shop. Pulsa **Consultar retos disponibles**, ajusta las cantidades por nivel e inicia la ejecución.

Si el objetivo usa una IP privada o HTTP, el contenedor de Dokploy debe poder acceder a esa dirección desde su red. Usa `ALLOWED_TARGETS` cuando el servicio quede expuesto a Internet; el token impide que visitantes sin autorización inicien ejecuciones.

## API

```http
POST /api/targets/inspect
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{"url":"https://juice.kormind.com/"}
```

La respuesta muestra por nivel el total, los ya resueltos, los deshabilitados, los pendientes habilitados y los pendientes con un intento en este motor. Para iniciar una ejecución:

```http
POST /api/runs
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{"url":"https://juice.kormind.com/","quotas":{"1":5,"2":6,"3":4,"4":0,"5":0,"6":0}}
```

La respuesta `202` contiene un `id`. Consulta `GET /api/runs/<id>` con el mismo encabezado para ver el progreso. Solo se permite una ejecución simultánea. `GET /health` sirve para la comprobación de salud.

## Alcance

El motor incluye intentos basados en los retos documentados para Juice Shop v20.2.0. Algunos requieren navegador, credenciales estándar o características que una instancia concreta puede tener desactivadas. La vista previa muestra cuántos intentos están disponibles, pero un intento puede fallar en una versión modificada. Si no alcanza alguna cuota, el estado será `partial`. Un intento puede resolver varios retos relacionados; el informe separa los retos adicionales fuera de la distribución solicitada. La aplicación guarda los informes en memoria; se pierden al reiniciar el contenedor.

Referencias: [API de retos](https://pwning.owasp-juice.shop/companion-guide/latest/part4/integration.html) y [soluciones de Juice Shop v20.2.0](https://pwning.owasp-juice.shop/companion-guide/snapshot/appendix/solutions.html).

## Desarrollo y pruebas

`npm test` ejecuta las pruebas del motor. El contenedor incluye Chromium mediante la imagen oficial de Playwright.
