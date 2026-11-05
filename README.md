# Sistema de Control Docente & Operaciones de Sede (UPN Comas)
## Arquitectura en PHP, SQLite y Frontend Mobile-First (Preparado para APK Nativo)

Sistema de alta velocidad diseñado para reemplazar AppSheet, con **backend nativo en PHP**, base de datos relacional **SQLite**, sincronización inteligente con **`CONTROL DOCENTE.xlsx`** y una interfaz moderna y simétrica optimizada para dispositivos móviles y empaquetado en APK.

---

## 🚀 Inicio Rápido con PHP

Simplemente haz doble clic en el archivo:
```
iniciar_sistema.bat
```
El script inicia el servidor web de PHP en el puerto 8000 y abre tu navegador automáticamente en:
👉 **`http://localhost:8000`**

---

## 🛡️ Mejoras de Seguridad Implementadas

1. **Protección Contra Inyección SQL (100% PDO Prepared Statements):**
   - Todas las consultas a la base de datos utilizan sentencias preparadas con enlace estricto de parámetros en PHP (`PDO::PARAM_STR`, `PDO::PARAM_INT`).
2. **Cabeceras de Seguridad HTTP:**
   - `X-Content-Type-Options: nosniff` (previene MIME sniffing).
   - `X-Frame-Options: SAMEORIGIN` (mitigación de clickjacking).
   - `X-XSS-Protection: 1; mode=block` (filtro contra cross-site scripting).
   - `Referrer-Policy: strict-origin-when-cross-origin`.
   - Control estricto de CORS para clientes web y móviles nativos.
3. **Validación y Sanitización de Entradas (Whitelist):**
   - Estados de asistencia, puntualidad y tickets validados contra listas blancas permitidas (`PUNTUAL`, `TARDE`, `FALTA`, `SI`, `NO`, `REEMPLAZO`).
   - Sanitización de cadenas con codificación UTF-8 e inmunización contra ataques XSS.
4. **Protección Contra Path Traversal:**
   - Validación estricta de rutas de archivos para evitar fugas fuera del directorio público.

---

## 🔄 Adaptabilidad a Futuras Actualizaciones de `CONTROL DOCENTE.xlsx`

El archivo de Excel cambiará con el tiempo (nuevos ciclos académicos, adición de cursos, cambios de horarios o docentes). El sistema se adapta automáticamente:

- **Detección Automática de Modificación:**
  - El backend en PHP compara la fecha de modificación (`filemtime`) y la suma hash (`md5_file`) de `CONTROL DOCENTE.xlsx`.
- **Sincronización Inteligente sin Borrar Asistencias:**
  - Cuando detecta que el archivo Excel fue actualizado, lee los nuevos datos.
  - Actualiza la información de los cursos, docentes, ciclos y horarios modificados.
  - Inserta las clases nuevas que se hayan agregado.
  - **PRESERVA INTACTAS LAS ASISTENCIAS YA REGISTRADAS:** Si un asistente ya marcó una clase como "Puntual" o "Tarde", la sincronización no borra esa marca.
- **Botón "Auto-Sync Excel" en la Barra Superior:**
  - Permite forzar la sincronización en cualquier momento con un solo clic.

---

## 📱 Interfaz Mobile-First, Simétrica y Preparada para APK

- **Ergonomía Táctil y Simetría:**
  - Botones de acción principales de asistencia (`[✓ Puntual]`, `[⏱ Tarde]`, `[✕ Falta]`) con altura estándar de 48px, ancho simétrico de 3 columnas y micro-interacción al tacto (`active:scale-95`).
  - Navegación flotante inferior (*Floating Bottom Dock*) estilo app nativa de iOS y Android para pantallas móviles.
  - Formularios en paneles deslizables desde abajo (*Bottom Sheet Drawers*) con manija táctil.
- **Preparado para APK (Capacitor / Cordova / WebView):**
  - Archivo `public/manifest.json` configurado en modo `standalone`.
  - Icono SVG vectorial responsivo.
  - Soporte de márgenes seguros para notch e islas dinámicas (`env(safe-area-inset-bottom)`).
  - Eliminación del destello azul táctil (`-webkit-tap-highlight-color: transparent`) y bloqueo de zooms accidentales.

---

## 📂 Estructura del Proyecto

```
├── api/
│   ├── Database.php               # Conexión PDO SQLite con WAL y PRAGMAs
│   ├── Security.php               # Middleware de seguridad, CORS y validaciones
│   ├── ExcelSyncer.php            # Auto-detección y sincronizador incremental
│   ├── sync_worker.js             # Extractor seguro de CONTROL DOCENTE.xlsx
│   ├── AttendanceController.php   # API de pase de lista y ronda
│   ├── TicketsController.php      # API de mesa de ayuda
│   ├── ManualSheetsController.php # API de correlativos de hojas manuales
│   ├── ReservationsController.php # API de disponibilidad de espacios
│   ├── RoomsController.php        # API de directorio de ambientes
│   └── DashboardController.php    # API de métricas ejecutivas
├── php/                           # Binarios portables de PHP 8.5 (sin instalación)
├── router.php                     # Router del servidor PHP y servidor estático
├── server/
│   └── data/
│       └── controldocente.sqlite  # Base de datos SQLite relacional
├── src/                           # Código fuente React Mobile-First
├── dist/                          # Build compilado listo para web y APK
├── CONTROL DOCENTE.xlsx           # Archivo maestro de Excel (sin alterar)
└── iniciar_sistema.bat            # Ejecutable de 1 clic para Windows
```
