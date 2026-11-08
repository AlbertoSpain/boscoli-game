# Boscoli · Aventura en el Reino Cuqui

Videojuego de plataformas 2D estilo retro para niños de 6 a 10 años. Hecho solo con HTML, CSS y JavaScript: sin instalaciones ni dependencias.

## Cómo jugar

Abre `index.html` en el navegador (doble clic). También puedes servirlo con cualquier servidor estático, por ejemplo `python3 -m http.server`.

1. Elige tu personaje cuqui (Michi, Nube, Bambú o Toby) y el nivel de dificultad.
2. Recorre el mundo saltando por las plataformas y recoge estrellas ⭐ (cada una da +1 segundo en la batalla).
3. Al llegar al castillo te enfrentas al animal gruñón en una **batalla de magia**: encuentra todas las palabras de la sopa de letras antes de que se cargue su hechizo. ¡Cada palabra lanza un hechizo tuyo!
4. Si ganas, el villano vuelve a ser cuqui y se hace tu amigo. Si no, puedes repetir con una sopa nueva.

Son 3 mundos: Bosque Arcoíris (Rufo el Zorro), Cueva de Cristal (Murci la Murciélaga) y Castillo de las Nubes (Lobo Gruñón).

## Controles

| Tecla | Plataformas | Batalla |
| --- | --- | --- |
| ← → / A D | Moverse | Mover el cursor |
| ↑ ↓ / W S | ↑ salta | Mover el cursor |
| Espacio | Saltar | Marcar inicio y fin de la palabra |
| H | — | Pista (3 por batalla) |
| Esc | Pausa | Cancelar selección |
| P | Pausa | — |
| M | Sonido on/off | Sonido on/off |

En la batalla también se puede usar el ratón: arrastra de la primera a la última letra.

## Dificultad

- **Peque (6-7 años):** 5 corazones, sopas pequeñas, palabras solo en horizontal y vertical y más tiempo.
- **Mayor (8-10 años):** 3 corazones, sopas más grandes y palabras también en diagonal.

Nunca hay "game over": al perder todos los corazones se vuelve al último punto de control.

## Estructura

```
index.html          Página y panel de la sopa de letras
css/style.css       Estilos
js/audio.js         Música y efectos chiptune (Web Audio)
js/data.js          Personajes, mundos, palabras y dificultad
js/ui.js            Utilidades de dibujo (texto, paneles, cielo)
js/sprites.js       Sprites pixel-art generados por código
js/wordsearch.js    Generador de sopas de letras
js/platformer.js    Motor de plataformas
js/battle.js        Batalla mágica
js/main.js          Bucle principal y pantallas
```

Para añadir palabras edita `WORD_POOLS` en `js/data.js`; para cambiar un mundo, edita la lista `ops` de `LEVELS`.
