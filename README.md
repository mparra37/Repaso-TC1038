# Repaso TC1038: funciones, ciclos y listas

App web para repasar el segundo examen de Fundamentos de Programación. Funciona en el celular y en la computadora, y todo se resuelve en pantalla: no hay fotos ni IA, así que no necesita API key ni servidor. El `index.html` de la raíz redirige a `docs/`.

## Qué tiene

**Bienvenida:** la primera vez se pide nombre y matrícula (sin validar) y se muestran instrucciones básicas. Se pueden corregir con «Cambiar» en la pantalla de inicio.

**Puntuación final:** el botón «📸 Ver mi puntuación final» muestra en una sola pantalla el nombre, la matrícula, las ★ y los ejercicios resueltos (en total y por tema), con la fecha y la hora. Es la pantalla de la que los alumnos toman captura para subirla a Canvas.

**60 ejercicios cortos** en 6 temas, que siguen las sesiones 11 a 17:

| Tema | Ejercicios |
|---|---|
| Funciones | 10 |
| Ciclo for | 11 |
| Ciclo while | 11 |
| Ciclos anidados | 10 |
| Listas | 13 |
| Retos: funciones con listas (agregar, buscar, promediar, ganador, filtrar) | 5 |

Todos son interactivos, de siete tipos:

| Tipo | Qué hace el alumno | ★ |
|---|---|---|
| Opción múltiple | Elige una respuesta (una sola oportunidad) | 1 |
| ¿Qué imprime? | Escribe la salida exacta del programa | 2 |
| Completa el código | Llena los huecos dentro del código | 2 |
| Encuentra el error | Toca la línea con el error y elige cómo corregirla | 2 |
| Prueba de escritorio | Llena la tabla de valores vuelta por vuelta | 3 |
| Ordena el programa | Acomoda las líneas y ajusta la sangría (algunas sobran) | 3 |
| Programa | Escribe una función o programa corto; se ejecuta con Python en el navegador (Pyodide) contra casos de prueba | 4 |

Cada intento fallido o pista resta 1 ★ a ese ejercicio (mínimo 1). Después de dos intentos aparece «Ver la respuesta», que deja el ejercicio en 0 ★. Los puntos se guardan en el navegador de cada alumno, y en la pantalla de inicio está «Reiniciar puntos».

## Estructura

```
Repaso-TC1038/
├── index.html                ← redirige a docs/
├── docs/                     ← el sitio que publica GitHub Pages
│   ├── index.html
│   ├── css/estilos.css
│   ├── js/app.js             ← interfaz y los 7 tipos de ejercicio
│   ├── js/ejecutor.js        ← corre Python en un Web Worker (con límite de tiempo)
│   ├── js/pyworker.js        ← carga Pyodide
│   ├── py/evaluador.py       ← ejecuta las pruebas de los programas
│   └── data/ejercicios.json  ← lo genera herramientas/generar.py
└── herramientas/             ← NO se sube (está en .gitignore): tiene las soluciones
    ├── ejercicios.py         ← aquí se escriben y editan los ejercicios
    └── generar.py            ← verifica todo con Python y escribe ejercicios.json
```

## Probar en tu computadora

```bash
python -m http.server 8038 --directory docs
```

Abre <http://localhost:8038>. Tiene que abrirse con un servidor (`http://`): con doble clic en `index.html` (`file://`) no carga.

## Publicar en GitHub Pages

1. En GitHub crea un repositorio vacío, por ejemplo `Repaso-TC1038` (público está bien: las soluciones de los programas no se suben).
2. En una terminal, dentro de la carpeta `Repaso-TC1038`:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Repaso TC1038"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/mparra37/Repaso-TC1038.git
```

```bash
git push -u origin main
```

3. En GitHub: *Settings → Pages → Build and deployment → Deploy from a branch*, rama `main`, carpeta **`/docs`**.
4. En uno o dos minutos queda en <https://mparra37.github.io/Repaso-TC1038/>.

## Agregar o cambiar ejercicios

Todo está en `herramientas/ejercicios.py` (al inicio del archivo se explica cada tipo). Después de editar:

```bash
python -X utf8 herramientas/generar.py
```

El generador ejecuta cada ejercicio con Python y se detiene si algo no cuadra. Calcula solo las salidas de «¿Qué imprime?», «Completa el código» y «Ordena el programa», y los resultados esperados de las pruebas de cada programa a partir de su solución. También revisa que las respuestas alternativas den lo mismo, que las líneas intercambiables lo sean de verdad, que en «Encuentra el error» solo una corrección funcione y que las tablas de la prueba de escritorio coincidan con la ejecución real. Al final, sube el `docs/data/ejercicios.json` nuevo.

Formatos rápidos:

- Huecos de «Completa el código»: `for i in range(⟦1⟧, ⟦n + 1|n+1⟧):` (con `|` se separan respuestas aceptadas).
- Celdas por llenar en la prueba de escritorio: `"?24"`.
- Líneas que pueden ir en cualquier orden en «Ordena el programa»: `"grupos": [[0, 1]]`.

## Cómo usarlo en clase (sugerencia)

1. Al abrirla, cada alumno escribe su nombre y matrícula. Si ya la había abierto antes, que pulse «Reiniciar puntos».
2. Práctica libre durante la clase, en el orden que quieran.
3. Al final: «📸 Ver mi puntuación final», captura de pantalla y entrega en Canvas. La fecha y la hora en la captura ayudan a ver que es de esa sesión.

## Límites conocidos

- Las respuestas están en `ejercicios.json` y un alumno curioso podría leerlas. Los puntos se guardan en el navegador del alumno, así que alguien con conocimientos podría modificarlos. Para una actividad de práctica no importa.
- En «¿Qué imprime?» se ignoran los espacios de más y los renglones vacíos, y las comillas dobles o sencillas dan lo mismo; las mayúsculas sí cuentan (`True` ≠ `true`).
- Los programas necesitan internet la primera vez para descargar Pyodide (~10 MB). Los demás tipos funcionan sin Python.
- Los ejercicios de la sesión 18 (tuplas y diccionarios) todavía no están incluidos.
