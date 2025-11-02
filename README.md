# RedSocial – Flujos de Autenticación

Este proyecto incorpora login/registro tradicionales, inicio de sesión con Google (ID Token flow) y protección reCAPTCHA v2 para el alta manual.

## Variables de entorno
- `GOOGLE_CLIENT_ID`: ID de cliente OAuth 2.0 usado por Google Identity Services en el frontend y backend.
- `GOOGLE_CLIENT_SECRET`: Clave del cliente OAuth (reservada para futuros flujos code exchange).
- `RECAPTCHA_SITE_KEY`: Site key pública para renderizar el widget v2 checkbox en el frontend.
- `RECAPTCHA_SECRET_KEY`: Clave privada usada por el backend para validar respuestas reCAPTCHA.
- `JWT_SECRET` *(opcional)*: Secreto para firmar el JWT de sesión; si no se define se usa el valor por defecto del proyecto.
- `SESSION_COOKIE_NAME` *(opcional)*: Nombre de la cookie HttpOnly que transporta el JWT (default `app_session`).
- `CORS_ORIGINS` *(opcional)*: Lista separada por comas con los orígenes autorizados para peticiones con credenciales.

## Rutas relevantes
- `POST /api/auth/login`: Autenticación tradicional (email/contraseña).
- `POST /api/auth/register`: Registro manual (requiere `recaptchaToken` con la respuesta del widget).
- `POST /api/auth/google`: Inicio de sesión con Google; recibe `{ idToken }`.
- `GET /api/auth/config`: Expone `googleClientId` y `recaptchaSiteKey` al frontend.

Todas las respuestas exitosas generan un JWT que se firma y se envía en:
1. Una cookie HttpOnly (`SameSite=Lax`, `Secure` en producción) para sesión del navegador.
2. El campo `token` de la respuesta JSON, conservando compatibilidad con los flujos existentes.

## Consideraciones adicionales
- El backend verifica las respuestas reCAPTCHA contra `https://www.google.com/recaptcha/api/siteverify`.
- Las cuentas Google se vinculan por `googleId` o, en su defecto, por email; la primera vez se crea un usuario con los campos `googleId`, `provider`, `picture` y un `nick` único generado automáticamente.
- El middleware de autenticación acepta tanto cabeceras `Authorization` como la cookie HttpOnly configurada.
