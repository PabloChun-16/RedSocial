# RedSocial – Flujos de Autenticación

Este proyecto incorpora login/registro tradicionales, inicio de sesión con Google (ID Token flow) y protección reCAPTCHA v2 para el alta manual.

## Variables de entorno
- `AWS_REGION`: Región AWS usada por S3, Rekognition y Translate.
- `S3_BUCKET`: Bucket privado donde se almacenan las imágenes de publicaciones.
- `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`: Credenciales utilizadas por los SDK de AWS.
- `AWS_REKOGNITION_REGION` *(opcional)* y `AWS_TRANSLATE_REGION` *(opcional)*: Regiones específicas para Rekognition/Translate (default `us-east-1` si no se define).
- `GOOGLE_CLIENT_ID`: ID de cliente OAuth 2.0 usado por Google Identity Services en el frontend y backend.
- `GOOGLE_CLIENT_SECRET`: Clave del cliente OAuth (reservada para futuros flujos code exchange).
- `RECAPTCHA_SITE_KEY`: Site key pública para renderizar el widget v2 checkbox en el frontend.
- `RECAPTCHA_SECRET_KEY`: Clave privada usada por el backend para validar respuestas reCAPTCHA.
- `JWT_SECRET` *(opcional)*: Secreto para firmar el JWT de sesión; si no se define se usa el valor por defecto del proyecto.
- `SESSION_COOKIE_NAME` *(opcional)*: Nombre de la cookie HttpOnly que transporta el JWT (default `app_session`).
- `CORS_ORIGINS` *(opcional)*: Lista separada por comas con los orígenes autorizados para peticiones con credenciales.
- `AI_MAX_LABELS` *(opcional)*: Límite de etiquetas retornadas por Rekognition (default 10).
- `AI_MIN_CONFIDENCE` *(opcional)*: Confianza mínima para aceptar una etiqueta (default 70).
- `AI_SUGGEST_MAX_MB` *(opcional)*: Tamaño máximo (MB) para la imagen temporal del endpoint de sugerencias (default 10).

## Rutas relevantes
- `POST /api/auth/login`: Autenticación tradicional (email/contraseña).
- `POST /api/auth/register`: Registro manual (requiere `recaptchaToken` con la respuesta del widget).
- `POST /api/auth/google`: Inicio de sesión con Google; recibe `{ idToken }`.
- `GET /api/auth/config`: Expone `googleClientId` y `recaptchaSiteKey` al frontend.
- `POST /api/ai/suggest-tags`: Recibe una imagen en memoria y devuelve sugerencias de etiquetas traducidas al español sin guardar nada.
- `GET /api/publication/search`: Busca publicaciones por texto, `tags` manuales o `autoTags` generadas automáticamente.
- `GET /api/search/users`: Sugerencias de usuarios para la barra global según nombre o nick.
- `GET /api/search/posts`: Retorna publicaciones que coinciden con caption, `tags` o `autoTags`.

Todas las respuestas exitosas generan un JWT que se firma y se envía en:
1. Una cookie HttpOnly (`SameSite=Lax`, `Secure` en producción) para sesión del navegador.
2. El campo `token` de la respuesta JSON, conservando compatibilidad con los flujos existentes.

## Consideraciones adicionales
- El backend verifica las respuestas reCAPTCHA contra `https://www.google.com/recaptcha/api/siteverify`.
- Las cuentas Google se vinculan por `googleId` o, en su defecto, por email; la primera vez se crea un usuario con los campos `googleId`, `provider`, `picture` y un `nick` único generado automáticamente.
- El middleware de autenticación acepta tanto cabeceras `Authorization` como la cookie HttpOnly configurada.
- Cada publicación guarda `tags` (manuales) y `autoTags` (generadas con Rekognition + Translate). Las respuestas del feed, perfiles y buscador incluyen `imageUrl` firmado y ambas listas de etiquetas.
- El endpoint de sugerencias (`/api/ai/suggest-tags`) usa Rekognition con `Image.Bytes` para analizar imágenes temporales antes de publicarlas.
