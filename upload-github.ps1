# Ejecuta este script desde el directorio del proyecto
# Asegura que el repo está en la rama main y listo para push.

Set-Location -Path "$PSScriptRoot"

Write-Host "Agregando archivos al stage..."
git add usuarios.html change-logo.patch

Write-Host "Creando commit..."
git commit -m "Priorizar logo.png en usuarios.html para GitHub Pages"

Write-Host "Haciendo push a origin/main..."
git push origin main

Write-Host "Listo. Revisa si el push se completó correctamente."