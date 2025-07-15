#!/bin/bash

cd JungleSVG || exit 1

echo "Corrigiendo nombres de archivos SVG..."

# Renombrar todos los archivos con 'morada' a 'morado'
for file in *morada.svg; do
  [ -e "$file" ] && newname="${file/morada/morado}" && mv -f "$file" "$newname"
done

# Renombrar todos los archivos con 'amarilla' a 'amarillo'
for file in *amarilla.svg; do
  [ -e "$file" ] && newname="${file/amarilla/amarillo}" && mv -f "$file" "$newname"
done

# Renombrar todos los archivos con 'narajna' a 'naranja'
for file in *narajna.svg; do
  [ -e "$file" ] && newname="${file/narajna/naranja}" && mv -f "$file" "$newname"
done

echo "Renombrado completado." 