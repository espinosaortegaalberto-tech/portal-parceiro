# Portal de gestión de cartera de partners

Portal web interno para gestionar la cartera de partners que captan contratos de energía (luz y gas) para el canal presencial: alta de partners, carga mensual de ventas, cálculo de comisiones, seguimiento, control de checks de onboarding y exportación de liquidaciones en PDF.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS.
- **Backend/BBDD**: Supabase (PostgreSQL + Auth + RLS), proyecto en región UE.
- **Autenticación**: Entra ID (Azure AD) como proveedor SSO en Supabase Auth. Sin auto-registro.
- **Hosting**: Vercel (auto-deploy desde `main`). El frontend es estático; todos los datos viven en Supabase.

## Puesta en marcha (desarrollo local)

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env` y rellena las variables con los valores de tu proyecto Supabase (Settings → API):

   ```bash
   cp .env.example .env
   ```

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (la anon key es pública a propósito: la seguridad la da RLS + SSO)

3. Ejecuta el esquema SQL en Supabase **antes** de arrancar el frontend (ver siguiente sección).

4. Arranca el entorno de desarrollo:

   ```bash
   npm run dev
   ```

   `npm run dev` / `npm run build` **no** despliegan nada; el despliegue lo hace Vercel automáticamente al hacer `git push` a `main`.

5. Ejecuta los tests del módulo de cálculo de comisiones:

   ```bash
   npm test
   ```

## Migraciones de base de datos (ejecución MANUAL)

Vercel no tiene acceso a la base de datos: **cualquier cambio de esquema debe ejecutarse a mano en el SQL Editor de Supabase**, antes de desplegar el código que dependa de él.

- Esquema inicial completo: [`supabase/schema.sql`](supabase/schema.sql)
- Cambios incrementales posteriores: `supabase/migrations/` (nombrados `NNN_descripcion.sql`, en orden)

Pasos:

1. Entra en tu proyecto de Supabase → **SQL Editor**.
2. Pega y ejecuta el contenido de `supabase/schema.sql` (es idempotente, se puede volver a ejecutar sin duplicar objetos).
3. Ejecuta también, en orden, cada fichero de `supabase/migrations/`:
   - `001_fn_versionar_configuracion_comisiones.sql` — función RPC que usa la pantalla de configuración de comisiones.
   - `002_vistas_seguimiento_ventas.sql` — vistas agregadas (actualmente sin uso por la UI; ver nota en CLAUDE.md).
   - `003_estado_pago_comisiones.sql` — añade `estado_pago`/`fecha_pago` a `comisiones`, usado por la pantalla de pagos.
4. Verifica en **Table Editor** que se han creado las tablas: `partners`, `cargas`, `ventas`, `configuracion_comisiones`, `comisiones`, `checks`.

## Configuración manual de Entra ID SSO (pendiente para el final del proyecto)

Durante el desarrollo se puede usar un usuario de prueba de Supabase Auth (email/password). Antes de pasar a producción hay que configurar el login corporativo:

1. **Registrar una App en Entra ID** (Azure Portal → Microsoft Entra ID → App registrations → New registration):
   - Tipo: aplicación web / SSO empresarial.
   - Redirect URI: `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
   - Anota `Application (client) ID`, `Directory (tenant) ID` y genera un `Client secret`.
   - Restringe el acceso a los usuarios/grupos del tenant corporativo que deban entrar al portal (sin auto-registro).

2. **Dar de alta el proveedor en Supabase** (Authentication → Providers → Azure, o SSO/SAML si se requiere ese modo):
   - Introduce el `Client ID`, `Client secret` y `Tenant ID` obtenidos en el paso anterior.
   - Si se usa **SSO SAML** en lugar de OIDC, ten en cuenta que puede requerir el **plan Pro de Supabase**.

3. El código del frontend ya está preparado para delegar el login en Supabase Auth; una vez configurado el proveedor, solo hay que apuntar el botón de login al provider correspondiente (`supabase.auth.signInWithOAuth({ provider: 'azure', ... })`) — pendiente de Fase final.

## Estructura del repositorio

```
/src
  /components
  /pages        (partners, comisiones, seguimiento, checks, configuracion, reporting)
  /lib          (supabaseClient, calculoComisiones, parseExcel, generarPdf)
  /styles
/supabase
  schema.sql
  /migrations
CLAUDE.md
README.md
.gitignore
.env.example
```

## Seguridad y datos

- RLS activado en todas las tablas; solo usuarios autenticados del tenant corporativo pueden leer/escribir.
- Datos alojados en Supabase región UE.
- Los partners **no** acceden al portal; solo reciben su PDF de liquidación por email/canal externo.
- `.gitignore` excluye `.env`, Excel con datos reales y PDFs generados: **ningún dato de partners debe llegar al repositorio.**
