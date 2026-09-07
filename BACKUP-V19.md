# Copia de seguridad antes de la migración

Esta rama conserva la configuración de publicación que sirve la Versión 19 estable antes de migrar todos los archivos de la aplicación al repositorio.

- Versión visible: 19
- Rama de producción anterior: `feature/standalone-app-v1`
- Fuente estable: `https://diktat-player-main-candidate.mario-martinez-gomez.chatgpt.site`
- Página en uso: `https://mamargom.github.io/diktat-player-pwa/`
- Fecha del punto de recuperación: 2026-09-07

Para volver atrás, se puede restaurar `.github/workflows/publish.yml` desde esta rama en `feature/standalone-app-v1` y ejecutar el workflow. La fuente estable en Sites permanece intacta.
