import { preparar, evaluar } from "./ejecutor.js";

const CLAVE = "repaso-tc1038-v1";

const vista = document.getElementById("vista");
const marcadorPuntos = document.getElementById("puntos");
const avisoPuntos = document.getElementById("aviso-puntos");

let datos = null;
// Ejercicios que el alumno abrió otra vez para practicar (sin puntos).
const repasos = new Set();

// ---------- utilidades ----------

function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nombre === "class") nodo.className = valor;
    else if (nombre.startsWith("on")) nodo.addEventListener(nombre.slice(2), valor);
    else if (valor === true) nodo.setAttribute(nombre, "");
    else nodo.setAttribute(nombre, valor);
  }
  agregar(nodo, hijos);
  return nodo;
}

function agregar(nodo, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

function reemplazar(nodo, ...hijos) {
  nodo.replaceChildren();
  agregar(nodo, hijos);
}

function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const almacen = {
  leer(clave, defecto) {
    try {
      const texto = localStorage.getItem(`${CLAVE}:${clave}`);
      return texto === null ? defecto : JSON.parse(texto);
    } catch {
      return defecto;
    }
  },
  guardar(clave, valor) {
    try {
      localStorage.setItem(`${CLAVE}:${clave}`, JSON.stringify(valor));
    } catch {
      /* sin almacenamiento: la app sigue funcionando */
    }
  },
};

// ---------- resaltado de Python ----------

const PATRON =
  /(#.*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b(def|return|if|elif|else|for|while|in|not|and|or|import|from|True|False|None|break|continue|pass)\b|\b(print|input|int|float|str|len|range|sum|max|min|list|round|type)\b(?=\s*\()/g;

function resaltar(texto) {
  const nodos = [];
  let ultimo = 0;
  for (const m of texto.matchAll(PATRON)) {
    if (m.index > ultimo) nodos.push(texto.slice(ultimo, m.index));
    const clase = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : m[4] ? "k" : "f";
    nodos.push(el("span", { class: `tok-${clase}` }, m[0]));
    ultimo = m.index + m[0].length;
  }
  nodos.push(texto.slice(ultimo));
  return nodos;
}

function bloqueCodigo(codigo) {
  return el("pre", { class: "codigo" }, codigo.startsWith("Traceback") ? codigo : resaltar(codigo));
}

function bloqueSalida(renglones, maximo = 8) {
  const visibles = renglones.length > maximo ? [...renglones.slice(0, maximo - 1), "…"] : renglones;
  return el("pre", { class: "codigo salida" }, visibles.join("\n"));
}

function entradasTexto(entradas) {
  return el(
    "p",
    { class: "entradas" },
    "El usuario escribe: ",
    entradas.map((e) => el("code", {}, e)),
  );
}

// ---------- progreso y puntos ----------

const estado = Object.assign({ hechos: {}, fallos: {}, pistas: {}, codigos: {} }, almacen.leer("estado", {}));

function guardarEstado() {
  almacen.guardar("estado", estado);
  pintarPuntos();
}

function temaDe(ejercicio) {
  return datos.temas.find((t) => t.id === ejercicio.tema);
}

function puntosDe(ejercicio) {
  return datos.tipos[ejercicio.tipo].puntos;
}

function valorActual(ejercicio) {
  const restan = (estado.fallos[ejercicio.id] || 0) + (estado.pistas[ejercicio.id] || 0);
  return Math.max(1, puntosDe(ejercicio) - restan);
}

function resuelto(ejercicio) {
  return estado.hechos[ejercicio.id] !== undefined;
}

function puntosTotales() {
  return datos.ejercicios.reduce((suma, e) => suma + (estado.hechos[e.id] || 0), 0);
}

function puntosPosibles() {
  return datos.ejercicios.reduce((suma, e) => suma + puntosDe(e), 0);
}

function pintarPuntos() {
  if (!datos) return;
  marcadorPuntos.textContent = `★ ${puntosTotales()}`;
  marcadorPuntos.setAttribute("aria-label", `${puntosTotales()} puntos`);
}

function celebrar(puntos) {
  avisoPuntos.textContent = `+${puntos} ★`;
  avisoPuntos.classList.add("visible");
  setTimeout(() => avisoPuntos.classList.remove("visible"), 1600);
}

function siguientePendiente() {
  const ejercicio = datos.ejercicios.find((e) => !resuelto(e));
  return ejercicio ? `#/ej/${ejercicio.id}` : "#/";
}

function ir(ruta) {
  if (location.hash === ruta) mostrar();
  else location.hash = ruta;
}

// ---------- piezas comunes ----------

function barraAcciones(...botones) {
  return el("div", { class: "acciones" }, el("div", { class: "acciones__contenido" }, botones));
}

function boton(texto, alClic, clase = "") {
  return el("button", { type: "button", class: `boton ${clase}`.trim(), onclick: alClic }, texto);
}

function cajaRetro(clase, titulo, ...contenido) {
  return el("div", { class: `explicacion ${clase}` }, el("strong", {}, titulo), contenido);
}

function enfocarRetro(retro) {
  requestAnimationFrame(() => retro.scrollIntoView({ behavior: "smooth", block: "nearest" }));
}

function sinMarcas(nodos) {
  for (const nodo of nodos) nodo.classList.remove("ok", "mal");
}

// ---------- normalización de respuestas ----------

function renglon(texto) {
  return texto
    .trim()
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .replace(/\s*([[\](),:])\s*/g, "$1");
}

function renglones(texto) {
  return texto.replace(/\r/g, "").split("\n").map(renglon).filter(Boolean);
}

function compacto(texto) {
  return texto.replace(/\s+/g, "").replace(/'/g, '"');
}

function celdaIgual(escrito, esperado) {
  const a = escrito.trim().replace(/\s+/g, "").toLowerCase();
  const b = esperado.trim().replace(/\s+/g, "").toLowerCase();
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return a !== "" && !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
}

// =====================================================================
// Componentes: uno por tipo de ejercicio.
// Cada uno regresa { nodo, listo(), revisar(), revelar() }.
// revisar() regresa { ok, mensaje, detalle?, sigue? }.
//   sigue: true  → paso intermedio correcto, todavía no termina (sin castigo).
// =====================================================================

function compOpcion(ej, cambio) {
  let elegida = null;
  let cerrada = false;
  const contenedor = el("div", { class: "opciones", role: "group", "aria-label": "Opciones" });

  function pintar() {
    reemplazar(
      contenedor,
      ej.opciones.map((texto, i) => {
        let clase = "opcion";
        if (cerrada && i === ej.correcta) clase += " correcta";
        else if (cerrada && i === elegida) clase += " incorrecta";
        else if (cerrada) clase += " apagada";
        else if (i === elegida) clase += " seleccionada";
        return el(
          "button",
          {
            type: "button",
            class: clase,
            disabled: cerrada,
            "aria-pressed": !cerrada && i === elegida ? "true" : "false",
            onclick: () => {
              elegida = i;
              pintar();
              cambio();
            },
          },
          el("span", { class: "opcion__letra" }, "ABCD"[i]),
          ej.codigo_opciones ? el("span", { class: "opcion__codigo" }, resaltar(texto)) : el("span", {}, texto),
        );
      }),
    );
  }
  pintar();

  return {
    nodo: [el("h2", {}, ej.pregunta), ej.codigo ? bloqueCodigo(ej.codigo) : null, contenedor],
    unaOportunidad: true,
    listo: () => elegida !== null,
    revisar() {
      cerrada = true;
      pintar();
      return elegida === ej.correcta ? { ok: true } : { ok: false, mensaje: "La respuesta correcta está marcada en verde." };
    },
    revelar() {
      cerrada = true;
      pintar();
    },
  };
}

function compSalida(ej, cambio) {
  const area = el("textarea", {
    class: "respuesta",
    id: `resp-${ej.id}`,
    rows: Math.min(10, Math.max(3, ej.respuesta.length + 1)),
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    autocorrect: "off",
    placeholder: "Un renglón por línea",
  });
  area.addEventListener("input", () => {
    sinMarcas([area]);
    cambio();
  });
  const solucion = el("div", { class: "grupo", hidden: true }, el("span", { class: "etiqueta" }, "El programa imprime"), bloqueSalida(ej.respuesta, 40));

  return {
    nodo: [
      el("h2", {}, "¿Qué imprime este programa?"),
      bloqueCodigo(ej.codigo),
      ej.entradas ? entradasTexto(ej.entradas) : null,
      el("div", { class: "grupo" }, el("label", { class: "etiqueta", for: area.id }, "Tu respuesta, exactamente como sale en pantalla"), area),
      solucion,
    ],
    listo: () => area.value.trim() !== "",
    revisar() {
      const mia = renglones(area.value);
      const buena = ej.respuesta.map(renglon).filter(Boolean);
      if (mia.length === buena.length && mia.every((r, i) => r === buena[i])) {
        area.classList.add("ok");
        area.readOnly = true;
        return { ok: true };
      }
      area.classList.add("mal");
      let mensaje;
      if (mia.length === buena.length && mia.every((r, i) => r.toLowerCase() === buena[i].toLowerCase())) {
        mensaje = "Casi: revisa mayúsculas y minúsculas (True, False y None van con mayúscula).";
      } else if (mia.length !== buena.length) {
        mensaje = `Tu respuesta tiene ${mia.length} renglón${mia.length === 1 ? "" : "es"} y el programa imprime ${buena.length}.`;
      } else {
        const k = mia.findIndex((r, i) => r !== buena[i]);
        mensaje = `El renglón ${k + 1} no es correcto. Haz la prueba de escritorio con calma.`;
      }
      return { ok: false, mensaje };
    },
    revelar() {
      area.readOnly = true;
      solucion.hidden = false;
    },
  };
}

function compCompletar(ej, cambio) {
  const huecos = [];
  const codigo = el(
    "pre",
    { class: "codigo" },
    ej.partes.map((parte) => {
      if (!Array.isArray(parte)) return resaltar(parte);
      const ancho = Math.max(3, ...parte.map((r) => r.length)) + 1;
      const entrada = el("input", {
        class: "hueco",
        style: `width:${ancho}ch`,
        spellcheck: "false",
        autocapitalize: "off",
        autocomplete: "off",
        autocorrect: "off",
        enterkeyhint: "next",
        "aria-label": `Hueco ${huecos.length + 1}`,
      });
      entrada.addEventListener("input", () => {
        sinMarcas([entrada]);
        cambio();
      });
      huecos.push({ entrada, respuestas: parte });
      return entrada;
    }),
  );
  const etiquetaSalida = ej.entradas ? `Si el usuario escribe ${ej.entradas.join(", ")}, imprime` : "Debe imprimir";

  return {
    nodo: [
      el("h2", {}, ej.enunciado),
      codigo,
      el("div", { class: "grupo" }, el("span", { class: "etiqueta" }, etiquetaSalida), bloqueSalida(ej.salida)),
    ],
    listo: () => huecos.every((h) => h.entrada.value.trim() !== ""),
    revisar() {
      let malos = 0;
      for (const h of huecos) {
        const ok = h.respuestas.some((r) => compacto(r) === compacto(h.entrada.value));
        h.entrada.classList.add(ok ? "ok" : "mal");
        if (!ok) malos++;
      }
      if (!malos) {
        for (const h of huecos) h.entrada.readOnly = true;
        return { ok: true };
      }
      return {
        ok: false,
        mensaje: malos === 1 ? "Hay un hueco incorrecto (marcado en rojo)." : `Hay ${malos} huecos incorrectos (marcados en rojo).`,
      };
    },
    revelar() {
      for (const h of huecos) {
        h.entrada.value = h.respuestas[0];
        h.entrada.readOnly = true;
        sinMarcas([h.entrada]);
        h.entrada.classList.add("ok");
      }
    },
  };
}

function compError(ej, cambio) {
  const lineas = ej.codigo.split("\n");
  let paso = 1;
  let lineaElegida = null;
  let lineaMala = null;
  let cerrada = false;
  const lista = el("div", { class: "lineas", role: "group", "aria-label": "Líneas del programa" });
  let opcionElegida = null;
  const descartadas = new Set();
  const cajaOpciones = el("div", { class: "opciones", role: "group", "aria-label": "Correcciones" });
  const paso2 = el("div", { class: "grupo", hidden: true }, el("h2", {}, "¿Cómo se corrige esa línea?"), cajaOpciones);

  function pintarOpciones() {
    reemplazar(
      cajaOpciones,
      ej.opciones.map((texto, i) => {
        let clase = "opcion";
        if (cerrada && i === ej.correcta) clase += " correcta";
        else if (descartadas.has(i)) clase += " incorrecta";
        else if (cerrada) clase += " apagada";
        else if (i === opcionElegida) clase += " seleccionada";
        return el(
          "button",
          {
            type: "button",
            class: clase,
            disabled: cerrada || descartadas.has(i),
            "aria-pressed": i === opcionElegida ? "true" : "false",
            onclick: () => {
              opcionElegida = i;
              pintarOpciones();
              cambio();
            },
          },
          el("span", { class: "opcion__letra" }, "ABCD"[i]),
          el("span", { class: "opcion__codigo" }, resaltar(texto)),
        );
      }),
    );
  }
  pintarOpciones();

  function pintar() {
    reemplazar(
      lista,
      lineas.map((texto, i) => {
        const numero = i + 1;
        let clase = "linea";
        if (paso === 2 && numero === ej.linea) clase += " ok";
        else if (numero === lineaMala) clase += " mal";
        else if (numero === lineaElegida) clase += " seleccionada";
        return el(
          "button",
          {
            type: "button",
            class: clase,
            disabled: paso === 2 || cerrada,
            "aria-pressed": numero === lineaElegida ? "true" : "false",
            onclick: () => {
              lineaElegida = numero;
              lineaMala = null;
              pintar();
              cambio();
            },
          },
          el("span", { class: "linea__numero" }, numero),
          el("span", { class: "linea__texto" }, texto ? resaltar(texto) : " "),
        );
      }),
    );
  }
  pintar();

  return {
    nodo: [el("h2", {}, ej.enunciado), ej.entradas ? entradasTexto(ej.entradas) : null, lista, paso2],
    listo: () => !cerrada && (paso === 1 ? lineaElegida !== null : opcionElegida !== null),
    revisar() {
      if (paso === 1) {
        if (lineaElegida === ej.linea) {
          paso = 2;
          pintar();
          paso2.hidden = false;
          return { sigue: true, mensaje: "¡Esa es la línea! Ahora elige cómo se corrige." };
        }
        lineaMala = lineaElegida;
        lineaElegida = null;
        pintar();
        return { ok: false, mensaje: `La línea ${lineaMala} está bien. Busca el error en otra.` };
      }
      if (opcionElegida === ej.correcta) {
        cerrada = true;
        pintarOpciones();
        return { ok: true };
      }
      descartadas.add(opcionElegida);
      opcionElegida = null;
      pintarOpciones();
      return { ok: false, mensaje: "Esa corrección no arregla el problema. Prueba con otra." };
    },
    revelar() {
      paso = 2;
      cerrada = true;
      lineaMala = null;
      pintar();
      paso2.hidden = false;
      pintarOpciones();
    },
  };
}

function compTraza(ej, cambio) {
  const celdas = [];
  const tabla = el(
    "table",
    {},
    el("thead", {}, el("tr", {}, ej.columnas.map((c) => el("th", { scope: "col" }, c)))),
    el(
      "tbody",
      {},
      ej.filas.map((fila, f) =>
        el(
          "tr",
          {},
          fila.map((valor, c) => {
            if (!valor.startsWith("?")) return el("td", {}, valor);
            const entrada = el("input", {
              class: "celda",
              spellcheck: "false",
              autocapitalize: "off",
              autocomplete: "off",
              autocorrect: "off",
              enterkeyhint: "next",
              "aria-label": `${ej.columnas[c]}, fila ${f + 1}`,
            });
            entrada.addEventListener("input", () => {
              sinMarcas([entrada]);
              cambio();
            });
            celdas.push({ entrada, respuesta: valor.slice(1) });
            return el("td", {}, entrada);
          }),
        ),
      ),
    ),
  );

  return {
    nodo: [el("h2", {}, ej.enunciado), bloqueCodigo(ej.codigo), el("div", { class: "traza" }, tabla)],
    listo: () => celdas.every((c) => c.entrada.value.trim() !== ""),
    revisar() {
      let malas = 0;
      for (const c of celdas) {
        const ok = celdaIgual(c.entrada.value, c.respuesta);
        c.entrada.classList.add(ok ? "ok" : "mal");
        if (!ok) malas++;
      }
      if (!malas) {
        for (const c of celdas) c.entrada.readOnly = true;
        return { ok: true };
      }
      return {
        ok: false,
        mensaje: malas === 1 ? "Hay una celda incorrecta (en rojo)." : `Hay ${malas} celdas incorrectas (en rojo).`,
      };
    },
    revelar() {
      for (const c of celdas) {
        c.entrada.value = c.respuesta;
        c.entrada.readOnly = true;
        sinMarcas([c.entrada]);
        c.entrada.classList.add("ok");
      }
    },
  };
}

function compOrdenar(ej, cambio) {
  const solucion = ej.lineas.map((t) => ({ texto: t.trim(), sangria: (t.length - t.trimStart().length) / 4 }));
  const piezas = barajar([
    ...solucion.map((s, k) => ({ id: `l${k}`, texto: s.texto })),
    ...ej.distractores.map((t, k) => ({ id: `d${k}`, texto: t.trim() })),
  ]);
  let colocadas = [];
  let cerrada = false;
  let marcada = null;
  const programa = el("div", { class: "orden", "aria-label": "Tu programa" });
  const banco = el("div", { class: "banco", "aria-label": "Líneas disponibles" });

  function sangriaSugerida() {
    const anterior = colocadas[colocadas.length - 1];
    if (!anterior) return 0;
    return anterior.pieza.texto.endsWith(":") ? anterior.sangria + 1 : anterior.sangria;
  }

  function cambiar() {
    marcada = null;
    programa.classList.remove("ok");
    pintar();
    cambio();
  }

  function pintar() {
    reemplazar(
      programa,
      colocadas.length
        ? colocadas.map((c, i) =>
            el(
              "div",
              { class: "orden__fila" },
              el(
                "button",
                {
                  type: "button",
                  class: "orden__sangria",
                  disabled: cerrada || c.sangria === 0,
                  "aria-label": "Quitar sangría",
                  onclick: () => {
                    c.sangria--;
                    cambiar();
                  },
                },
                "⇤",
              ),
              el(
                "button",
                {
                  type: "button",
                  class: "orden__sangria",
                  disabled: cerrada || c.sangria >= 3,
                  "aria-label": "Agregar sangría",
                  onclick: () => {
                    c.sangria++;
                    cambiar();
                  },
                },
                "⇥",
              ),
              el(
                "button",
                {
                  type: "button",
                  class: `orden__linea${i === marcada ? " mal" : ""}`,
                  disabled: cerrada,
                  "aria-label": `Línea ${i + 1}: ${c.pieza.texto}. Toca para quitarla.`,
                  onclick: () => {
                    colocadas.splice(i, 1);
                    cambiar();
                  },
                },
                el("span", { class: "guia" }, "·  ".repeat(c.sangria)),
                resaltar(c.pieza.texto),
              ),
            ),
          )
        : el("p", { class: "orden__vacio" }, "Toca las líneas de abajo en orden."),
    );
    const usadas = new Set(colocadas.map((c) => c.pieza.id));
    const libres = piezas.filter((p) => !usadas.has(p.id));
    reemplazar(
      banco,
      libres.length
        ? libres.map((p) =>
            el(
              "button",
              {
                type: "button",
                class: "banco__linea",
                disabled: cerrada,
                onclick: () => {
                  colocadas.push({ pieza: p, sangria: sangriaSugerida() });
                  cambiar();
                },
              },
              resaltar(p.texto),
            ),
          )
        : el("p", { class: "banco__vacio" }, "Ya usaste todas las líneas."),
    );
  }
  pintar();

  function grupoDe(k) {
    return ej.grupos.find(([a, b]) => k >= a && k <= b);
  }

  function comparar() {
    if (colocadas.some((c) => c.pieza.id.startsWith("d"))) {
      const k = colocadas.findIndex((c) => c.pieza.id.startsWith("d"));
      return { k, mensaje: "Hay una línea que no va en este programa." };
    }
    for (let k = 0; k < solucion.length; k++) {
      if (k >= colocadas.length) return { k: null, mensaje: `Faltan líneas: el programa completo tiene ${solucion.length}.` };
      const grupo = grupoDe(k);
      if (grupo && grupo[0] === k) {
        if (colocadas.length <= grupo[1]) {
          const dentro = solucion.slice(grupo[0], grupo[1] + 1);
          const todasBien = colocadas.slice(grupo[0]).every((c) => dentro.some((s) => s.texto === c.pieza.texto && s.sangria === c.sangria));
          if (todasBien) return { k: null, mensaje: `Faltan líneas: el programa completo tiene ${solucion.length}.` };
        }
        const esperado = solucion.slice(grupo[0], grupo[1] + 1).map((s) => `${s.sangria}|${s.texto}`).sort();
        const puestos = colocadas.slice(grupo[0], grupo[1] + 1).map((c) => `${c.sangria}|${c.pieza.texto}`).sort();
        if (esperado.join("\n") === puestos.join("\n")) {
          k = grupo[1];
          continue;
        }
      } else if (grupo) {
        continue;
      }
      const puesto = colocadas[k];
      const esperado = solucion[k];
      if (!grupo && puesto.pieza.texto === esperado.texto && puesto.sangria === esperado.sangria) continue;
      if (grupo) {
        const dentro = solucion.slice(grupo[0], grupo[1] + 1);
        const conTexto = colocadas.slice(grupo[0], grupo[1] + 1).findIndex((c) => !dentro.some((s) => s.texto === c.pieza.texto));
        if (conTexto === -1) return { k: grupo[0], mensaje: "El orden va bien, pero revisa la sangría de las primeras líneas." };
        return { k: grupo[0] + conTexto, mensaje: `Revisa el orden a partir de la línea ${grupo[0] + conTexto + 1}.` };
      }
      if (puesto.pieza.texto === esperado.texto) return { k, mensaje: `La línea ${k + 1} va bien, pero su sangría no. ¿Va dentro de un bloque o fuera?` };
      return { k, mensaje: `Revisa el orden a partir de la línea ${k + 1}.` };
    }
    return null;
  }

  const etiquetaSalida = ej.entradas ? `Si el usuario escribe ${ej.entradas.join(", ")}, imprime` : "Debe imprimir";

  return {
    nodo: [
      el("h2", {}, ej.enunciado),
      el("div", { class: "grupo" }, el("span", { class: "etiqueta" }, "Tu programa · ⇤ ⇥ cambian la sangría"), programa),
      el("div", { class: "grupo" }, el("span", { class: "etiqueta" }, "Líneas disponibles"), banco),
      el("div", { class: "grupo" }, el("span", { class: "etiqueta" }, etiquetaSalida), bloqueSalida(ej.salida)),
    ],
    listo: () => colocadas.length > 0,
    revisar() {
      const problema = comparar();
      if (!problema) {
        cerrada = true;
        programa.classList.add("ok");
        pintar();
        return { ok: true };
      }
      marcada = problema.k;
      pintar();
      return { ok: false, mensaje: problema.mensaje };
    },
    revelar() {
      colocadas = solucion.map((s) => ({ pieza: piezas.find((p) => p.texto === s.texto && p.id.startsWith("l")), sangria: s.sangria }));
      cerrada = true;
      marcada = null;
      programa.classList.add("ok");
      pintar();
    },
  };
}

// ---------- programa (se ejecuta con Pyodide) ----------

function crearEditor(valorInicial, alCambiar) {
  const numeros = el("pre", { class: "editor__numeros", "aria-hidden": "true" });
  const area = el("textarea", {
    class: "editor__texto",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    autocorrect: "off",
    wrap: "off",
    "aria-label": "Tu código",
    placeholder: "Escribe tu código aquí",
  });
  area.value = valorInicial;
  let lineaError = null;

  function pintarNumeros() {
    const total = Math.max(1, area.value.split("\n").length);
    numeros.replaceChildren(
      ...Array.from({ length: total }, (_, i) => el("span", { class: i + 1 === lineaError ? "error" : null }, `${i + 1}\n`)),
    );
  }

  area.addEventListener("input", () => {
    lineaError = null;
    pintarNumeros();
    alCambiar(area.value);
  });
  area.addEventListener("scroll", () => {
    numeros.scrollTop = area.scrollTop;
  });
  area.addEventListener("keydown", (evento) => {
    if (evento.key === "Tab" && !evento.shiftKey) {
      evento.preventDefault();
      area.setRangeText("    ", area.selectionStart, area.selectionEnd, "end");
      area.dispatchEvent(new Event("input"));
    } else if (evento.key === "Enter") {
      const inicio = area.value.lastIndexOf("\n", area.selectionStart - 1) + 1;
      const linea = area.value.slice(inicio, area.selectionStart);
      let sangria = linea.match(/^ */)[0];
      if (linea.trimEnd().endsWith(":")) sangria += "    ";
      if (sangria) {
        evento.preventDefault();
        area.setRangeText(`\n${sangria}`, area.selectionStart, area.selectionEnd, "end");
        area.dispatchEvent(new Event("input"));
      }
    }
  });
  pintarNumeros();

  return {
    nodo: el("div", { class: "editor" }, numeros, area),
    area,
    get valor() {
      return area.value;
    },
    set valor(texto) {
      area.value = texto;
      lineaError = null;
      pintarNumeros();
    },
    marcarLinea(numero) {
      lineaError = numero;
      pintarNumeros();
    },
  };
}

const ERRORES_SINTAXIS = [
  [/expected ':'/, "falta poner dos puntos ( : ) al final."],
  [/was never closed/, "un paréntesis o corchete se abrió y nunca se cerró."],
  [/unterminated string/, "un texto entre comillas no se cerró."],
  [/unmatched/, "sobra un paréntesis o corchete de cierre."],
  [/expected an indented block/, "después de los dos puntos, la siguiente línea debe llevar sangría."],
  [/unexpected indent/, "esta línea tiene sangría de más."],
  [/unindent does not match/, "la sangría no coincide con las líneas de arriba."],
  [/cannot assign to|Maybe you meant '=='/, "para comparar se usa == (con = se asigna)."],
  [/'return' outside function/, "hay un return fuera de la función: revisa la sangría."],
  [/invalid syntax/, "Python no entiende esta línea: revisa dos puntos, paréntesis, comas, comillas y = contra ==."],
];

const ERRORES_EJECUCION = {
  NameError: "usas un nombre que Python no conoce: revisa cómo lo escribiste y que exista antes de usarlo.",
  TypeError: "se mezclaron tipos de datos: ¿convertiste el input() con int() o float()? ¿la función regresa algo?",
  ValueError: "un dato no se pudo convertir, por ejemplo int() de un número con decimales.",
  ZeroDivisionError: "se dividió entre cero: revisa el divisor con un if antes de dividir.",
  IndexError: "usaste un índice que no existe: el último es len(lista) - 1.",
  UnboundLocalError: "usaste una variable dentro de la función antes de darle valor.",
  AttributeError: "ese método no existe; revisa el nombre (por ejemplo append, no add).",
};

function explicarError(error) {
  const donde = error.linea ? `Línea ${error.linea}: ` : "";
  if (["SyntaxError", "IndentationError", "TabError"].includes(error.tipo)) {
    const regla = ERRORES_SINTAXIS.find(([patron]) => patron.test(error.mensaje));
    return { titulo: "Error de sintaxis", texto: donde + (regla ? regla[1] : "Python no puede leer esta parte.") };
  }
  return { titulo: `El programa se detuvo (${error.tipo})`, texto: donde + (ERRORES_EJECUCION[error.tipo] || `ocurrió ${error.tipo}.`) };
}

function compPrograma(ej, cambio) {
  const clave = `codigo:${ej.id}`;
  const editor = crearEditor(almacen.leer(clave, ej.inicial || ""), (texto) => {
    almacen.guardar(clave, texto);
    cambio();
  });
  preparar().catch(() => {});

  const ejemplo = ej.ejemplo
    ? el(
        "pre",
        { class: "codigo", "aria-label": "Ejemplo de ejecución" },
        ej.ejemplo.entradas.map((entrada) => [el("span", { class: "prompt" }, ">>> "), `${entrada}\n`]),
        ej.ejemplo.salida.join("\n"),
      )
    : el(
        "pre",
        { class: "codigo", "aria-label": "Ejemplo de uso" },
        ej.ejemplo_llamadas.map((e) => [el("span", { class: "prompt" }, ">>> "), resaltar(e.llamada), `\n${e.resultado}\n`]),
      );

  return {
    nodo: [
      el("h1", {}, ej.titulo),
      el("p", {}, ej.descripcion),
      el(
        "div",
        { class: "datos" },
        el("div", { class: "dato" }, el("span", {}, "Entrada"), el("span", {}, ej.entrada)),
        el(
          "div",
          { class: "dato" },
          el("span", {}, "Salida"),
          Array.isArray(ej.salida) ? el("ul", { class: "lista-salida" }, ej.salida.map((l) => el("li", {}, l))) : el("span", {}, ej.salida),
        ),
        ej.usa ? el("div", { class: "dato usa" }, el("span", {}, "Usa"), el("span", {}, el("code", {}, ej.usa))) : null,
        el("div", { class: "dato" }, el("span", {}, "Ejemplo"), ejemplo),
      ),
      editor.nodo,
    ],
    esPrograma: true,
    listo: () => editor.valor.trim() !== "" && editor.valor.trim() !== (ej.inicial || "").trim(),
    async revisar() {
      const codigo = editor.valor;
      let reporte;
      try {
        reporte = await evaluar(codigo, ej);
      } catch (error) {
        if (error.message === "TIEMPO") {
          return { ok: false, mensaje: "Tu programa tardó demasiado y se detuvo: ¿hay un ciclo infinito o un input() de más?" };
        }
        return { sigue: true, mensaje: "No se pudo cargar Python. Revisa tu internet y vuelve a intentarlo." };
      }
      if (reporte.error?.linea) editor.marcarLinea(reporte.error.linea);
      const total = reporte.pruebas.length;
      const pasadas = reporte.pruebas.filter((p) => p.ok).length;
      const ok = !reporte.error && total > 0 && pasadas === total && reporte.avisos.length === 0;
      if (ok) {
        estado.codigos[ej.id] = codigo;
        editor.area.readOnly = true;
        return { ok: true };
      }
      let mensaje = `Pasaste ${pasadas} de ${total} casos de prueba.`;
      if (reporte.error && !total) {
        const info = explicarError(reporte.error);
        mensaje = `${info.titulo}. ${info.texto}`;
      } else if (pasadas === total && reporte.avisos.length) {
        mensaje = "Funciona, pero no cumple una regla del ejercicio.";
      }
      const fallidas = reporte.pruebas.filter((p) => !p.ok);
      const detalle = [
        reporte.avisos.map((a) => el("p", { class: "pista" }, a)),
        fallidas.length
          ? el(
              "ul",
              { class: "casos" },
              fallidas.slice(0, 2).map((p) => el("li", { class: "mal" }, el("strong", {}, p.descripcion), el("span", {}, p.detalle))),
            )
          : null,
        reporte.consola
          ? el("details", { class: "consola" }, el("summary", {}, "Ver lo que imprimió con el ejemplo"), el("pre", { class: "codigo" }, reporte.consola))
          : null,
      ];
      return { ok: false, mensaje, detalle };
    },
    revelar() {
      const guardado = estado.codigos[ej.id];
      if (guardado) editor.valor = guardado;
      editor.area.readOnly = true;
    },
  };
}

const COMPONENTES = {
  opcion: compOpcion,
  salida: compSalida,
  completar: compCompletar,
  error: compError,
  traza: compTraza,
  ordenar: compOrdenar,
  programa: compPrograma,
};

// =====================================================================
// Inicio
// =====================================================================

function vistaInicio() {
  const resueltos = datos.ejercicios.filter(resuelto).length;
  const empezado = resueltos > 0;

  return [
    el(
      "div",
      { class: "encabezado" },
      el("h1", {}, "Repaso de Python"),
      el("p", { class: "texto-suave" }, "Funciones, ciclos y listas. Todo se resuelve aquí."),
    ),
    el(
      "div",
      { class: "marcador" },
      el("div", {}, el("strong", {}, puntosTotales()), el("span", {}, `de ${puntosPosibles()} ★`)),
      el("div", {}, el("strong", {}, resueltos), el("span", {}, `de ${datos.ejercicios.length} ejercicios`)),
    ),
    el("p", { class: "subtitulo" }, "Temas"),
    el(
      "nav",
      { class: "lista", "aria-label": "Temas" },
      datos.temas.map((tema, i) => {
        const lista = datos.ejercicios.filter((e) => e.tema === tema.id);
        const hechos = lista.filter(resuelto).length;
        const pendiente = lista.find((e) => !resuelto(e)) || lista[0];
        const completo = hechos === lista.length;
        return el(
          "a",
          { class: `fila${completo ? " completa" : ""}`, href: `#/ej/${pendiente.id}` },
          el("span", { class: "fila__numero" }, completo ? "✓" : i + 1),
          el("span", { class: "fila__texto" }, el("strong", {}, tema.nombre), el("span", {}, tema.detalle)),
          el("span", { class: "fila__avance" }, `${hechos}/${lista.length}`),
        );
      }),
    ),
    el(
      "details",
      { class: "ayuda" },
      el("summary", {}, "¿Cómo se ganan las ★?"),
      el(
        "ul",
        {},
        Object.values(datos.tipos).map((t) => el("li", {}, `${t.nombre}: ${t.puntos} ★`)),
        el("li", {}, "Cada intento fallido o pista usada resta 1 ★ a ese ejercicio (mínimo 1)."),
        el("li", {}, "En opción múltiple solo hay una oportunidad."),
        el("li", {}, "Si ves la respuesta, ese ejercicio queda en 0 ★."),
      ),
    ),
    empezado
      ? el(
          "div",
          { class: "pie-inicio" },
          boton(
            "Reiniciar puntos",
            () => {
              if (!confirm("¿Borrar todos tus puntos y empezar de cero?")) return;
              estado.hechos = {};
              estado.fallos = {};
              estado.pistas = {};
              estado.codigos = {};
              repasos.clear();
              guardarEstado();
              mostrar();
            },
            "boton--enlace",
          ),
        )
      : null,
    barraAcciones(boton(empezado ? "Continuar →" : "Empezar →", () => ir(siguientePendiente()))),
  ];
}

// =====================================================================
// Práctica: un ejercicio
// =====================================================================

function vistaEjercicio(ej) {
  const tema = temaDe(ej);
  const tipo = datos.tipos[ej.tipo];
  const delTema = datos.ejercicios.filter((e) => e.tema === ej.tema);
  const posicion = delTema.indexOf(ej) + 1;
  const indice = datos.ejercicios.indexOf(ej);
  const anterior = datos.ejercicios[indice - 1];
  const posterior = datos.ejercicios[indice + 1];
  const rutaSiguiente = posterior ? `#/ej/${posterior.id}` : "#/";
  const repasando = repasos.has(ej.id);
  const sinPuntos = () => repasando || resuelto(ej);

  const chipValor = el("span", { class: "chip" });
  function pintarChip() {
    if (resuelto(ej)) {
      const ganados = estado.hechos[ej.id];
      chipValor.className = `chip${ganados ? " chip--ok" : ""}`;
      chipValor.textContent = ganados ? `✓ +${ganados} ★` : "0 ★";
    } else {
      chipValor.className = "chip";
      chipValor.textContent = `${valorActual(ej)} ★`;
    }
  }
  pintarChip();

  const retro = el("div", { class: "retro-zona", "aria-live": "polite" });
  const zonaPistas = el("div", { class: "pistas" });
  let terminado = false;

  const comp = COMPONENTES[ej.tipo](ej, actualizarBoton);
  const principal = boton("Revisar", accion);
  const verRespuesta = boton("Ver la respuesta (0 ★)", revelar, "boton--enlace ver-respuesta");
  verRespuesta.hidden = true;

  function actualizarBoton() {
    if (terminado) {
      principal.textContent = posterior ? "Siguiente →" : "Volver al inicio";
      principal.disabled = false;
    } else {
      principal.textContent = "Revisar";
      principal.disabled = !comp.listo();
    }
  }

  function pintarPistas() {
    if (!ej.pistas) return;
    const vistas = estado.pistas[ej.id] || 0;
    const quedan = ej.pistas.length - vistas;
    const cuesta = !sinPuntos() && valorActual(ej) > 1;
    reemplazar(
      zonaPistas,
      ej.pistas.slice(0, vistas).map((texto) => el("div", { class: "pista" }, `💡 ${texto}`)),
      quedan > 0 && !terminado
        ? boton(
            `💡 ${vistas ? "Otra pista" : "Pista"}${cuesta ? " (−1 ★)" : ""}`,
            () => {
              estado.pistas[ej.id] = vistas + 1;
              guardarEstado();
              pintarChip();
              pintarPistas();
            },
            "boton--enlace",
          )
        : null,
    );
  }

  function terminar(acerto, ganados, mensaje) {
    terminado = true;
    let titulo;
    if (acerto) titulo = ganados ? `¡Correcto! +${ganados} ★` : "¡Correcto!";
    else titulo = "Respuesta correcta";
    reemplazar(
      retro,
      mensaje ? cajaRetro("mal", "No es esa", mensaje) : null,
      cajaRetro(acerto ? "ok" : "info", titulo, ej.explicacion || (ej.tipo === "programa" ? "Tu programa pasó todos los casos de prueba." : "")),
    );
    verRespuesta.hidden = true;
    pintarChip();
    pintarPistas();
    actualizarBoton();
    enfocarRetro(retro);
  }

  function revelar() {
    comp.revelar();
    if (!sinPuntos()) {
      estado.hechos[ej.id] = 0;
      guardarEstado();
    }
    terminar(false, 0);
  }

  async function accion() {
    if (terminado) return ir(rutaSiguiente);
    if (!comp.listo()) return;
    principal.disabled = true;
    principal.textContent = "Revisando…";
    const r = await comp.revisar();
    if (r.sigue) {
      reemplazar(retro, cajaRetro("info", "Vas bien", r.mensaje));
      enfocarRetro(retro);
      actualizarBoton();
      return;
    }
    if (r.ok) {
      let ganados = 0;
      if (!sinPuntos()) {
        ganados = valorActual(ej);
        estado.hechos[ej.id] = ganados;
        guardarEstado();
        celebrar(ganados);
      } else if (ej.tipo === "programa") {
        guardarEstado();
      }
      terminar(true, ganados);
      return;
    }
    if (comp.unaOportunidad) {
      if (!sinPuntos()) {
        estado.hechos[ej.id] = 0;
        guardarEstado();
      }
      comp.revelar();
      terminar(false, 0, r.mensaje);
      return;
    }
    if (!comp.esPrograma && !sinPuntos()) {
      estado.fallos[ej.id] = (estado.fallos[ej.id] || 0) + 1;
      guardarEstado();
      pintarChip();
      pintarPistas();
    }
    reemplazar(retro, cajaRetro("mal", "Todavía no", r.mensaje, r.detalle ? el("div", { class: "detalle" }, r.detalle) : null));
    enfocarRetro(retro);
    const intentos = (estado.fallos[ej.id] || 0) + (repasando ? 2 : 0);
    if (!comp.esPrograma && intentos >= 2) verRespuesta.hidden = false;
    actualizarBoton();
  }

  pintarPistas();

  const yaResuelto = resuelto(ej) && !repasando;
  if (yaResuelto) {
    comp.revelar();
    terminado = true;
    const ganados = estado.hechos[ej.id];
    reemplazar(
      retro,
      cajaRetro(ganados ? "ok" : "info", ganados ? `Ya lo resolviste: +${ganados} ★` : "Ya viste la respuesta", ej.explicacion || ""),
      boton(
        "↺ Hacerlo otra vez (sin puntos)",
        () => {
          repasos.add(ej.id);
          mostrar();
        },
        "boton--enlace ver-respuesta",
      ),
    );
  }
  actualizarBoton();

  return [
    el(
      "div",
      { class: "encabezado" },
      el(
        "div",
        { class: "encabezado__fila" },
        el("span", { class: "etiqueta" }, `${tema.nombre} · ${posicion} de ${delTema.length}`),
        el("span", { class: "chips" }, el("span", { class: "chip chip--tipo" }, tipo.nombre), chipValor),
      ),
      el("div", { class: "progreso" }, el("span", { style: `width:${(posicion / delTema.length) * 100}%` })),
    ),
    comp.nodo,
    zonaPistas,
    retro,
    verRespuesta,
    barraAcciones(
      boton("←", () => ir(anterior ? `#/ej/${anterior.id}` : "#/"), "boton--claro boton--icono"),
      principal,
      boton("→", () => ir(rutaSiguiente), "boton--claro boton--icono"),
    ),
  ];
}

// =====================================================================
// Navegación
// =====================================================================

function mostrar() {
  if (!datos) return;
  const ruta = location.hash.replace(/^#\/?/, "");
  let contenido = null;
  let titulo = "Repaso TC1038";

  if (ruta.startsWith("ej/")) {
    const ejercicio = datos.ejercicios.find((e) => e.id === ruta.slice(3));
    if (ejercicio) {
      contenido = vistaEjercicio(ejercicio);
      titulo = `${temaDe(ejercicio).nombre} · Repaso TC1038`;
    }
  }
  if (!contenido) contenido = vistaInicio();
  document.title = titulo;
  reemplazar(vista, contenido);
  pintarPuntos();
  window.scrollTo(0, 0);
  vista.focus({ preventScroll: true });
}

async function iniciar() {
  try {
    const respuesta = await fetch("data/ejercicios.json", { cache: "no-cache" });
    datos = await respuesta.json();
  } catch {
    reemplazar(vista, el("p", {}, "No se pudieron cargar los ejercicios. Recarga la página."));
    return;
  }
  window.addEventListener("hashchange", mostrar);
  // Enter en un hueco o una celda pasa al siguiente; en el último, revisa.
  vista.addEventListener("keydown", (evento) => {
    const actual = evento.target;
    if (evento.key !== "Enter" || !actual.matches?.(".hueco, .celda")) return;
    evento.preventDefault();
    const todos = [...vista.querySelectorAll(".hueco, .celda")].filter((e) => !e.readOnly);
    const siguiente = todos[todos.indexOf(actual) + 1];
    if (siguiente) siguiente.focus();
    else document.querySelector(".acciones .boton:not(.boton--claro)")?.click();
  });
  mostrar();
}

iniciar();
